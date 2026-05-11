import { Task, Experiment } from './types';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, HeadingLevel, AlignmentType } from 'docx';
import { format } from 'date-fns';
import { he, enUS } from 'date-fns/locale';
import { TranslationDictionary } from "./types/i18n";

/**
 * Generates a "PDF" by opening a print-optimized window.
 * This is the most reliable way to handle Hebrew and complex CSS tables in the browser without heavy libraries.
 */
export const generateWeeklyPrintView = (
  tasks: Task[],
  experiments: Experiment[],
  weekDate: Date,
  t: TranslationDictionary,
  language: string,
  selectedExperimentId?: string
) => {
  // Filter relevant data
  let filteredExperiments = experiments;
  if (selectedExperimentId && selectedExperimentId !== 'all') {
    filteredExperiments = experiments.filter(e => e.id === selectedExperimentId);
  }

  // Create HTML content
  const weekString = format(weekDate, 'dd/MM/yyyy');

  const printContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
      <title>${t.reports.printTitle} - ${weekString}</title>
      <style>
        body { font-family: 'Assistant', sans-serif; padding: 20px; color: #1e293b; direction: ${language === 'he' ? 'rtl' : 'ltr'}; }
        h1 { text-align: center; color: #4f46e5; margin-bottom: 10px; }
        h2 { text-align: center; font-size: 16px; color: #64748b; margin-bottom: 30px; }
        .experiment-section { margin-bottom: 30px; page-break-inside: avoid; }
        .exp-title { font-size: 18px; font-weight: bold; border-bottom: 2px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 10px; color: #334155; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background-color: #f1f5f9; padding: 8px; text-align: ${language === 'he' ? 'right' : 'left'}; font-size: 12px; border: 1px solid #cbd5e1; }
        td { padding: 8px; border: 1px solid #cbd5e1; font-size: 13px; vertical-align: top; text-align: ${language === 'he' ? 'right' : 'left'}; }
        .checkbox-cell { width: 40px; text-align: center; }
        .checkbox-box { width: 16px; height: 16px; border: 2px solid #94a3b8; display: inline-block; border-radius: 3px; }
        .importance-high { color: #dc2626; font-weight: bold; }
        .desc { font-size: 11px; color: #64748b; margin-top: 4px; }
        @media print {
          body { -webkit-print-color-adjust: exact; }
          .no-print { display: none; }
        }
      </style>
      <link href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&display=swap" rel="stylesheet">
    </head>
    <body>
      <h1>${t.reports.weeklyTitle}</h1>
      <h2>${t.reports.weekOf} ${weekString}</h2>

      ${filteredExperiments.map(exp => {
    const expTasks = tasks.filter(t => t.experimentId === exp.id);
    if (expTasks.length === 0) return '';

    return `
          <div class="experiment-section">
            <div class="exp-title">${exp.name}</div>
            <table>
              <thead>
                <tr>
                  <th class="checkbox-cell">${t.reports.execution}</th>
                  <th>${t.reports.task}</th>
                  <th style="width: 80px;">${t.reports.importance}</th>
                  <th style="width: 80px;">${t.reports.status}</th>
                </tr>
              </thead>
              <tbody>
                ${expTasks.map(task => `
                  <tr>
                    <td class="checkbox-cell"><div class="checkbox-box"></div></td>
                    <td>
                      <div style="font-weight: 600;">${task.title}</div>
                      <div class="desc">${task.description || ''}</div>
                    </td>
                    <td>${task.importance >= 4 ? `<span class="importance-high">${t.reports.high}</span>` : t.reports.normal}</td>
                    <td>${task.status === 'completed' ? t.reports.completed : t.reports.planned}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
  }).join('')}

      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(printContent);
    printWindow.document.close();
  }
};

/**
 * Generates a DOCX file using 'docx' library.
 */
export const generateWeeklyDocx = async (
  tasks: Task[],
  experiments: Experiment[],
  weekDate: Date,
  t: TranslationDictionary,
  selectedExperimentId?: string
) => {
  // Filter relevant data
  let filteredExperiments = experiments;
  if (selectedExperimentId && selectedExperimentId !== 'all') {
    filteredExperiments = experiments.filter(e => e.id === selectedExperimentId);
  }

  const sections = [];
  const weekString = format(weekDate, 'dd/MM/yyyy');

  // Title
  sections.push(
    new Paragraph({
      text: t.reports.weeklyTitle,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      bidirectional: true,
    }),
    new Paragraph({
      text: `${t.reports.weekOf} ${weekString}`,
      alignment: AlignmentType.CENTER,
      bidirectional: true,
      spacing: { after: 400 }
    })
  );

  // Iterate Experiments
  filteredExperiments.forEach(exp => {
    const expTasks = tasks.filter(t => t.experimentId === exp.id);
    if (expTasks.length === 0) return;

    // Experiment Header
    sections.push(
      new Paragraph({
        text: exp.name,
        heading: HeadingLevel.HEADING_2,
        bidirectional: true,
        spacing: { before: 400, after: 200 },
        border: { bottom: { color: "auto", space: 1, value: "single", size: 6 } }
      })
    );

    // Tasks Table
    const tableRows = [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({ width: { size: 10, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: t.reports.execution, alignment: AlignmentType.CENTER, bidirectional: true })], shading: { fill: "f1f5f9" } }),
          new TableCell({ width: { size: 60, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: t.reports.description, alignment: AlignmentType.RIGHT, bidirectional: true })], shading: { fill: "f1f5f9" } }),
          new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: t.reports.importance, alignment: AlignmentType.CENTER, bidirectional: true })], shading: { fill: "f1f5f9" } }),
          new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: t.reports.status, alignment: AlignmentType.CENTER, bidirectional: true })], shading: { fill: "f1f5f9" } }),
        ],
      })
    ];

    expTasks.forEach(task => {
      tableRows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ text: "☐", alignment: AlignmentType.CENTER, size: 28 })], // Checkbox character
              verticalAlign: "center"
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [new TextRun({ text: task.title, bold: true })],
                  bidirectional: true,
                  alignment: AlignmentType.RIGHT
                }),
                new Paragraph({
                  text: task.description,
                  bidirectional: true,
                  alignment: AlignmentType.RIGHT,
                  style: "Subtitle" // Or just smaller text
                })
              ]
            }),
            new TableCell({
              children: [new Paragraph({
                text: task.importance >= 4 ? t.reports.high : t.reports.normal,
                alignment: AlignmentType.CENTER,
                bidirectional: true,
                color: task.importance >= 4 ? "DC2626" : "000000"
              })],
              verticalAlign: "center"
            }),
            new TableCell({
              children: [new Paragraph({ text: task.completed ? t.reports.completed : t.reports.planned, alignment: AlignmentType.CENTER, bidirectional: true })],
              verticalAlign: "center"
            }),
          ],
        })
      );
    });

    sections.push(
      new Table({
        rows: tableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
      })
    );
  });

  const doc = new Document({
    sections: [{
      properties: {},
      children: sections,
    }],
    compatibility: {
      doNotExpandShiftReturn: true,
    },
  });

  const blob = await Packer.toBlob(doc);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Weekly_Tasks_${weekString.replace(/\//g, '-')}.docx`;
  a.click();
  window.URL.revokeObjectURL(url);
};

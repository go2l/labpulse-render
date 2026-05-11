import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import {
  PlusIcon,
  CalendarIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  TableCellsIcon,
  ArchiveBoxIcon,
  CalendarDaysIcon,
  LanguageIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  UserCircleIcon
} from '@heroicons/react/24/outline';

interface HeaderProps {
  onNewExperiment: () => void;
  onWeeklySummary: () => void;
  onMonthlySummary: () => void;
  onSettings: () => void;
  onImport: () => void;
  onExport: () => void;
  onExportCsv: () => void;
  onOpenArchive: () => void;
  onJumpToToday: () => void;
  viewOffset: number;
}

const Header: React.FC<HeaderProps> = ({
  onNewExperiment,
  onWeeklySummary,
  onMonthlySummary,
  onSettings,
  onImport,
  onExport,
  onExportCsv,
  onOpenArchive,
  onJumpToToday,
  viewOffset
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const { t, language, toggleLanguage } = useLanguage();
  const { signOut, user, isGuest, previousLoginTime } = useAuth();

  return (
    <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-40 shadow-sm transition-colors">
      <div className="px-4 md:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <ChartBarIcon className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white tracking-tight">{t.common.appName}</h1>
        </div>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={onNewExperiment}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
          >
            <PlusIcon className="w-5 h-5" />
            <span>{t.header.newExperiment}</span>
          </button>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-600 mx-2"></div>

          <button
            onClick={onJumpToToday}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors border ${viewOffset === 0 ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 font-bold' : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
            title={t.header.jumpToToday}
          >
            <CalendarDaysIcon className="w-5 h-5" />
            <span className="text-sm">{t.common.today}</span>
          </button>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-600 mx-2"></div>

          <button onClick={onWeeklySummary} className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors" title={t.header.weeklySummary}>
            <CalendarIcon className="w-6 h-6" />
          </button>
          <button onClick={onMonthlySummary} className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors" title={t.header.monthlySummary}>
            <ChartBarIcon className="w-6 h-6" />
          </button>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-600 mx-2"></div>

          <button onClick={onOpenArchive} className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors" title={t.header.archive}>
            <ArchiveBoxIcon className="w-6 h-6" />
          </button>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-600 mx-2"></div>

          <button onClick={onImport} className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors" title={t.header.importData}>
            <ArrowUpTrayIcon className="w-6 h-6" />
          </button>
          <button onClick={onExport} className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors" title={t.header.exportJson}>
            <ArrowDownTrayIcon className="w-6 h-6" />
          </button>
          <button onClick={onExportCsv} className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors" title={t.header.exportCsv}>
            <TableCellsIcon className="w-6 h-6" />
          </button>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-600 mx-2"></div>

          <button onClick={toggleLanguage} className="flex items-center gap-1 px-2 py-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors font-bold text-xs" title={t.header.switchLanguage}>
            <span className="text-base">{language === 'he' ? '🇺🇸' : '🇮🇱'}</span>
            <span>{language === 'he' ? 'EN' : 'HE'}</span>
          </button>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-600 mx-2"></div>

          <button onClick={onSettings} className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors" title={t.header.settings}>
            <Cog6ToothIcon className="w-6 h-6" />
          </button>

          {(user || isGuest) && (
            <>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-600 mx-2"></div>

              <div className="relative group">
                <button
                  className="flex items-center gap-2 p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-600"
                  title={t.header.profile}
                >
                  <UserCircleIcon className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                  <div className="hidden lg:block ltr:text-left rtl:text-right">
                    <p className="text-xs font-bold leading-none">{user?.displayName || (isGuest ? t.header.guestUserLabel : 'User')}</p>
                    <p className="text-[10px] text-slate-500">{user?.email || (isGuest ? t.header.localMode : '')}</p>
                  </div>
                </button>

                {/* Dropdown Menu */}
                <div className="absolute ltr:right-0 rtl:left-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-2 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all z-50">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 mb-2">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{user?.displayName || t.header.guestUserLabel}</p>
                    <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                    {previousLoginTime && (
                      <p className="text-[10px] text-slate-400 mt-2">
                        {t.header.lastLogin} {new Date(previousLoginTime).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={signOut}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                  >
                    <ArrowRightOnRectangleIcon className="w-4 h-4" />
                    <span>{t.header.logout}</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden flex items-center gap-2">
          <button onClick={toggleLanguage} className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
            <span className="text-lg">{language === 'he' ? '🇺🇸' : '🇮🇱'}</span>
          </button>

          <button
            onClick={onNewExperiment}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm"
          >
            <PlusIcon className="w-4 h-4" />
            <span>{t.common.new}</span>
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
          >
            <Bars3Icon className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4 space-y-4 shadow-inner">
          <div className="grid grid-cols-4 gap-4">
            <button onClick={() => { onJumpToToday(); setMobileMenuOpen(false); }} className="flex flex-col items-center gap-1 text-slate-600 dark:text-slate-300">
              <div className="p-2 bg-white dark:bg-slate-700 rounded-full shadow-sm"><CalendarDaysIcon className="w-5 h-5" /></div>
              <span className="text-xs">{t.common.today}</span>
            </button>
            <button onClick={() => { onWeeklySummary(); setMobileMenuOpen(false); }} className="flex flex-col items-center gap-1 text-slate-600 dark:text-slate-300">
              <div className="p-2 bg-white dark:bg-slate-700 rounded-full shadow-sm"><CalendarIcon className="w-5 h-5" /></div>
              <span className="text-xs">{t.common.week}</span>
            </button>
            <button onClick={() => { onMonthlySummary(); setMobileMenuOpen(false); }} className="flex flex-col items-center gap-1 text-slate-600 dark:text-slate-300">
              <div className="p-2 bg-white dark:bg-slate-700 rounded-full shadow-sm"><ChartBarIcon className="w-5 h-5" /></div>
              <span className="text-xs">{t.common.month}</span>
            </button>
            <button onClick={() => { onOpenArchive(); setMobileMenuOpen(false); }} className="flex flex-col items-center gap-1 text-slate-600 dark:text-slate-300">
              <div className="p-2 bg-white dark:bg-slate-700 rounded-full shadow-sm"><ArchiveBoxIcon className="w-5 h-5" /></div>
              <span className="text-xs">{t.common.archive}</span>
            </button>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 pt-3 flex justify-around">
            <button onClick={onImport} className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-sm"><ArrowUpTrayIcon className="w-4 h-4" /> {t.common.import}</button>
            <button onClick={onExport} className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-sm"><ArrowDownTrayIcon className="w-4 h-4" /> {t.common.export}</button>
            <button onClick={onSettings} className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-sm"><Cog6ToothIcon className="w-4 h-4" /> {t.common.settings}</button>
          </div>

          {(user || isGuest) && (
            <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
              <div className="flex items-center gap-3 mb-3 px-2">
                <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-full">
                  <UserCircleIcon className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{user?.displayName || (isGuest ? t.header.guestUserLabel : 'User')}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{user?.email || (isGuest ? t.header.localMode : '')}</p>
                  {previousLoginTime && (
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {t.header.lastLogin} {new Date(previousLoginTime).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              <button onClick={signOut} className="w-full flex items-center justify-center gap-2 text-red-600 dark:text-red-400 text-sm font-bold bg-red-50 dark:bg-red-900/10 py-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
                <ArrowRightOnRectangleIcon className="w-4 h-4" />
                {t.header.logout} {isGuest ? `(${t.header.guestUser})` : ''}
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};

export default Header;

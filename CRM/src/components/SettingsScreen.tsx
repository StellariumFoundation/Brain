import { useState, useEffect } from 'react';
import { 
  Settings, Trash2, Database, Download, RefreshCw, AlertTriangle, 
  Check, FileSpreadsheet, Users, Tag, Folder, Info, HelpCircle 
} from 'lucide-react';
import { Contact } from '../types';
import { syncManager } from '../utils/syncManager';

interface SettingsScreenProps {
  onDatabaseReset: () => void;
  triggerRefreshStats?: number; // Counter to trigger refetch
}

export default function SettingsScreen({ onDatabaseReset, triggerRefreshStats = 0 }: SettingsScreenProps) {
  const [stats, setStats] = useState({
    totalContacts: 0,
    totalGroups: 0,
    totalTags: 0,
    groupDistribution: [] as { name: string; count: number }[]
  });
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const contacts = await syncManager.getContacts();
      const groups = syncManager.getGroups();
      const tags = syncManager.getTags();

      // Calculate distributions
      const groupCounts: { [key: string]: number } = {};
      contacts.forEach(c => {
        const gName = c.group_name || 'Unassigned';
        groupCounts[gName] = (groupCounts[gName] || 0) + 1;
      });

      const groupDistribution = Object.entries(groupCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      setStats({
        totalContacts: contacts.length,
        totalGroups: groups.length,
        totalTags: tags.length,
        groupDistribution
      });
    } catch (err: any) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [triggerRefreshStats]);

  const showFeedback = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Full CSV Export on client-side
  const handleExportCSV = async () => {
    try {
      const contacts = await syncManager.getContacts();

      if (contacts.length === 0) {
        showFeedback('No contacts exist in the database to export.', 'error');
        return;
      }

      // Generate headers
      const headers = ['Name', 'Phone', 'Email', 'Website', 'Group', 'Tags', 'Address', 'Company', 'Job Title', 'Notes', 'Birthday'];
      const csvRows = [headers.join(',')];

      contacts.forEach(c => {
        const row = [
          `"${(c.name || '').replace(/"/g, '""')}"`,
          `"${(c.phone || '').replace(/"/g, '""')}"`,
          `"${(c.email || '').replace(/"/g, '""')}"`,
          `"${(c.website || '').replace(/"/g, '""')}"`,
          `"${(c.group_name || '').replace(/"/g, '""')}"`,
          `"${(c.tags || '').replace(/"/g, '""')}"`,
          `"${(c.address || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
          `"${(c.company || '').replace(/"/g, '""')}"`,
          `"${(c.job_title || '').replace(/"/g, '""')}"`,
          `"${(c.notes || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
          `"${(c.birthday || '').replace(/"/g, '""')}"`
        ];
        csvRows.push(row.join(','));
      });

      const blob = new Blob([csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `crm_contacts_export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showFeedback('CSV file compiled and downloaded successfully.');
    } catch (err: any) {
      showFeedback('CSV Export failed: ' + err.message, 'error');
    }
  };

  // Unified vCard backup export
  const handleExportVCard = async () => {
    try {
      const contacts = await syncManager.getContacts();

      if (contacts.length === 0) {
        showFeedback('No contacts exist in the database to export.', 'error');
        return;
      }

      const vcards = contacts.map(c => {
        return [
          'BEGIN:VCARD',
          'VERSION:3.0',
          `FN:${c.name}`,
          c.phone ? `TEL;TYPE=CELL:${c.phone}` : '',
          c.email ? `EMAIL;TYPE=INTERNET:${c.email}` : '',
          c.website ? `URL:${c.website}` : '',
          c.company ? `ORG:${c.company}` : '',
          c.job_title ? `TITLE:${c.job_title}` : '',
          c.address ? `ADR;TYPE=WORK:;;${c.address.replace(/\n/g, ';')}` : '',
          c.birthday ? `BDAY:${c.birthday}` : '',
          c.notes ? `NOTE:${c.notes.replace(/\n/g, '\\n')}` : '',
          c.group_name ? `CATEGORIES:${c.group_name}${c.tags ? ',' + c.tags : ''}` : c.tags ? `CATEGORIES:${c.tags}` : '',
          'END:VCARD'
        ].filter(Boolean).join('\r\n');
      }).join('\r\n');

      const blob = new Blob([vcards], { type: 'text/vcard;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `crm_contacts_backup_${new Date().toISOString().slice(0, 10)}.vcf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showFeedback('vCard package file downloaded successfully.');
    } catch (err: any) {
      showFeedback('vCard Export failed: ' + err.message, 'error');
    }
  };

  // Database Reset to Demo Seeding
  const handleResetDatabase = async () => {
    if (!confirm('Warning: This will delete ALL current contacts and restore the 5 original Demo contacts. Proceed?')) {
      return;
    }

    try {
      // Step 1: Wipe database. We can bulk delete all contacts
      const contacts = await syncManager.getContacts();
      const ids = contacts.map(c => c.id).filter(id => id !== undefined) as (number | string)[];

      if (ids.length > 0) {
        await syncManager.bulkDelete(ids);
      }

      // Step 2: Seed them. We can do an import of the 5 originals
      const demoContacts = [
        {
          name: 'Alice Smith',
          phone: '+1 (555) 123-4567',
          email: 'alice@alphacorp.com',
          website: 'https://alphacorp.com',
          group_name: 'Customers',
          tags: 'vip, follow-up',
          address: '123 Main St, New York, NY',
          company: 'Alpha Corp',
          job_title: 'Sales Manager',
          notes: 'Prefers email communication. Interested in our enterprise product demo.',
          birthday: '1990-05-15'
        },
        {
          name: 'Bob Jones',
          phone: '+1 (555) 987-6543',
          email: 'bob@betalabs.co',
          website: 'https://betalabs.co',
          group_name: 'Leads',
          tags: 'tech, cold-lead',
          address: '456 Science Dr, Boston, MA',
          company: 'Beta Labs',
          job_title: 'Lead Engineer',
          notes: 'Met at TechConf 2026. Very interested in our API integrations.',
          birthday: '1985-11-22'
        },
        {
          name: 'Charlie Brown',
          phone: '+1 (555) 456-7890',
          email: 'charlie@gammaventures.com',
          website: 'https://gammaventures.com',
          group_name: 'Partners',
          tags: 'investor, high-priority',
          address: '789 Capital Way, San Francisco, CA',
          company: 'Gamma Ventures',
          job_title: 'CEO',
          notes: 'Looking for a strategic partnership in Q3. Keep updated regularly.',
          birthday: '1978-02-28'
        },
        {
          name: 'Diana Prince',
          phone: '+1 (555) 321-7654',
          email: 'diana@deltaltd.org',
          website: 'https://deltaltd.org',
          group_name: 'Customers',
          tags: 'active, friendly',
          address: '101 Amazon Pl, Seattle, WA',
          company: 'Delta Ltd',
          job_title: 'Marketing Director',
          notes: 'Regular customer, very happy with services. Loves receiving holiday greeting cards.',
          birthday: '1988-08-18'
        },
        {
          name: 'Evan Wright',
          phone: '+1 (555) 654-3210',
          email: 'evan@wrightconsulting.net',
          website: 'https://wrightconsulting.net',
          group_name: 'Consultants',
          tags: 'external, contract',
          address: '202 Solo Blvd, Austin, TX',
          company: 'Wright Consulting',
          job_title: 'Principal Consultant',
          notes: 'Helped with our system architecture setup. Key external resource.',
          birthday: '1993-12-05'
        }
      ];

      await syncManager.importContacts(demoContacts, '', []);

      showFeedback('Database has been completely reset and re-seeded with original demo contacts!');
      fetchStats();
      onDatabaseReset();
    } catch (err: any) {
      showFeedback('Database reset failed: ' + err.message, 'error');
    }
  };

  // Full Database Wipe
  const handleClearDatabase = async () => {
    if (!confirm('CRITICAL WARNING: This will permanently delete ALL contacts and tags in your CRM. This action is irreversible. Proceed?')) {
      return;
    }

    try {
      const contacts = await syncManager.getContacts();
      const ids = contacts.map(c => c.id).filter(id => id !== undefined) as (number | string)[];

      if (ids.length > 0) {
        await syncManager.bulkDelete(ids);
      }

      showFeedback('Database completely wiped! You now have a blank contact book.');
      fetchStats();
      onDatabaseReset();
    } catch (err: any) {
      showFeedback('Failed to wipe database: ' + err.message, 'error');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-950 text-slate-100 flex flex-col h-full">
      {/* Header Info */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-teal-300 flex items-center gap-2">
          <Settings className="h-5 w-5 text-teal-400 animate-spin-slow" />
          <span>CRM Control Center</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Perform offline-cached backups, review real-time database metrics, or reset the sandbox environment.
        </p>
      </div>

      {/* Floating feedback alert */}
      {feedback && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 rounded-full px-5 py-2.5 shadow-2xl flex items-center gap-2 text-xs font-semibold border ${
          feedback.type === 'success' 
            ? 'bg-teal-950/90 border-teal-500/50 text-teal-300 backdrop-blur-md' 
            : 'bg-rose-950/90 border-rose-500/50 text-rose-300 backdrop-blur-md'
        }`}>
          {feedback.type === 'success' ? <Check className="h-4 w-4 text-teal-400" /> : <AlertTriangle className="h-4 w-4 text-rose-400" />}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 max-w-5xl mx-auto w-full mb-12">
        {/* Left column: Database Metrics */}
        <div className="md:col-span-6 space-y-6">
          <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400 border-b border-slate-800 pb-2 flex items-center gap-1.5">
              <Database className="h-4 w-4 text-teal-400" />
              <span>Offline-First CRM Metrics</span>
            </h3>

            {loading ? (
              <div className="py-6 text-center text-xs text-slate-400 animate-pulse">Loading active metrics...</div>
            ) : (
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-slate-950/60 border border-slate-850/80 rounded-lg p-3">
                  <span className="block text-2xl font-black text-slate-100">{stats.totalContacts}</span>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase flex items-center justify-center gap-1 mt-1">
                    <Users className="h-3 w-3 text-teal-400" />
                    <span>Contacts</span>
                  </span>
                </div>
                
                <div className="bg-slate-950/60 border border-slate-850/80 rounded-lg p-3">
                  <span className="block text-2xl font-black text-slate-100">{stats.totalGroups}</span>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase flex items-center justify-center gap-1 mt-1">
                    <Folder className="h-3 w-3 text-teal-400" />
                    <span>Groups</span>
                  </span>
                </div>

                <div className="bg-slate-950/60 border border-slate-850/80 rounded-lg p-3">
                  <span className="block text-2xl font-black text-slate-100">{stats.totalTags}</span>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase flex items-center justify-center gap-1 mt-1">
                    <Tag className="h-3 w-3 text-teal-400" />
                    <span>Tags</span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Group breakdown */}
          <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400 border-b border-slate-800 pb-2">
              Contacts by Group
            </h3>
            {loading ? (
              <div className="py-4 text-center text-xs text-slate-500 animate-pulse">Loading breakdowns...</div>
            ) : stats.groupDistribution.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No groups registered yet.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {stats.groupDistribution.map(group => (
                  <div key={group.name} className="flex items-center justify-between text-xs py-1 border-b border-slate-900/50 last:border-0">
                    <span className="font-medium text-slate-300">{group.name}</span>
                    <span className="bg-teal-950/50 text-teal-300 font-bold px-2 py-0.5 rounded-full border border-teal-900/40">
                      {group.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Action Controls */}
        <div className="md:col-span-6 space-y-6">
          {/* Backups & Exports */}
          <div className="bg-slate-900/40 border border-slate-800/80 backdrop-blur-md rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400 border-b border-slate-800 pb-2 flex items-center gap-1.5">
              <Download className="h-4 w-4 text-teal-400" />
              <span>Full Database Backups</span>
            </h3>
            
            <p className="text-xs text-slate-400 leading-relaxed">
              Compile your contact book offline at any time. Ideal for importing directory files into third-party CRM platforms or spreadsheets.
            </p>

            <div className="space-y-2 pt-1">
              <button
                onClick={handleExportCSV}
                className="w-full py-2.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-slate-950 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-teal-900/20"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>Export to CSV Spreadsheet (.csv)</span>
              </button>

              <button
                onClick={handleExportVCard}
                className="w-full py-2.5 border border-slate-800 hover:border-teal-800 hover:bg-teal-950/20 text-teal-300 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="h-4 w-4" />
                <span>Export all to standard vCard (.vcf)</span>
              </button>
            </div>
          </div>

          {/* Database Actions */}
          <div className="bg-slate-900/40 border border-red-900/40 backdrop-blur-md rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-red-400 border-b border-red-950 pb-2 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-red-400 animate-pulse" />
              <span>Database Maintenance</span>
            </h3>

            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-slate-200">Reset & Seed Sandbox</span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  This wipes the active database and reloads 5 beautifully detailed demo profiles with emails, websites, tags, and groups.
                </p>
                <button
                  id="reset-db-btn"
                  onClick={handleResetDatabase}
                  className="mt-2 w-full py-2 border border-red-900 hover:border-red-600 hover:bg-red-950/20 text-red-300 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Restore Demo Seed Contacts</span>
                </button>
              </div>

              <div className="border-t border-slate-800/80 pt-3 flex flex-col gap-1">
                <span className="text-xs font-bold text-red-400">Factory Wipe Database</span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Permanently clear all contact cards and tags, starting your Brain CRM system from an absolute pristine clean slate.
                </p>
                <button
                  id="wipe-db-btn"
                  onClick={handleClearDatabase}
                  className="mt-2 w-full py-2.5 bg-red-950 border border-red-800/60 hover:bg-red-900 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-red-950/35"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete All Contacts (Wipe Database)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Infrastructure Context */}
          <div className="bg-teal-950/20 border border-teal-900/40 rounded-xl p-4 flex gap-3 text-xs text-slate-300 backdrop-blur-md">
            <Info className="h-4 w-4 text-teal-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-teal-300">PWA Offline & Cloud Sync Active</h4>
              <p className="mt-0.5 text-[11px] text-slate-400 leading-relaxed">
                This app runs completely offline. All actions — including resets and deletions — are instantly cached and will transparently replay and synchronize with the SQLite backend the moment you regain internet access!
              </p>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}

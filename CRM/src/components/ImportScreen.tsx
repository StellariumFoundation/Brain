import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { 
  Upload, FileSpreadsheet, Check, ArrowRight, HelpCircle, AlertCircle, 
  Trash2, Database, Play, Eye, Settings, ListPlus, RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ImportMapping } from '../types';
import { syncManager } from '../utils/syncManager';

interface ImportScreenProps {
  onImportSuccess: () => void;
}

export default function ImportScreen({ onImportSuccess }: ImportScreenProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Upload, 2: Map Fields & Defaults, 3: Import Summary/Complete
  
  // File State
  const [file, setFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<any[]>([]); // Full parsed raw rows
  const [parseError, setParseError] = useState<string | null>(null);

  // Field Mapping State
  const [fieldMapping, setFieldMapping] = useState<ImportMapping>({
    name: '',
    phone: '',
    email: '',
    website: '',
    group_name: '',
    tags: '',
    address: '',
    company: '',
    job_title: '',
    notes: '',
    birthday: ''
  });

  // Default parameters state
  const [defaultGroup, setDefaultGroup] = useState('');
  const [defaultTags, setDefaultTags] = useState('');

  // Execution State
  const [importing, setImporting] = useState(false);
  const [importCount, setImportCount] = useState<number | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Native HTML Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.csv')) {
        processCSV(droppedFile);
      } else {
        setParseError('Unsupported file format. Please upload a .csv file.');
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      processCSV(selectedFile);
    }
  };

  // CSV Parsing Engine
  const processCSV = (csvFile: File) => {
    setParseError(null);
    setFile(csvFile);

    Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0 && results.data.length === 0) {
          setParseError('Failed to parse CSV file: ' + results.errors[0].message);
          return;
        }

        const headers = results.meta.fields || [];
        if (headers.length === 0) {
          setParseError('Empty CSV file or headers not detected.');
          return;
        }

        setParsedHeaders(headers);
        setParsedRows(results.data);

        // Attempt smart mapping based on keywords
        const initialMapping = { ...fieldMapping };
        headers.forEach(h => {
          const lower = h.toLowerCase().replace(/[\s_-]/g, '');
          
          if (lower === 'name' || lower === 'fullname' || lower === 'displayname' || lower === 'contactname') {
            initialMapping.name = h;
          } else if (lower === 'phone' || lower === 'mobile' || lower === 'tel' || lower === 'cellphone' || lower === 'cell') {
            initialMapping.phone = h;
          } else if (lower === 'email' || lower === 'emailaddress' || lower === 'mail') {
            initialMapping.email = h;
          } else if (lower === 'website' || lower === 'web' || lower === 'site' || lower === 'url') {
            initialMapping.website = h;
          } else if (lower === 'group' || lower === 'folder' || lower === 'category' || lower === 'groups_name' || lower === 'group_name') {
            initialMapping.group_name = h;
          } else if (lower === 'tag' || lower === 'tags' || lower === 'label' || lower === 'labels') {
            initialMapping.tags = h;
          } else if (lower === 'address' || lower === 'location' || lower === 'addr' || lower === 'street') {
            initialMapping.address = h;
          } else if (lower === 'company' || lower === 'org' || lower === 'organization' || lower === 'employer') {
            initialMapping.company = h;
          } else if (lower === 'title' || lower === 'role' || lower === 'jobtitle' || lower === 'job') {
            initialMapping.job_title = h;
          } else if (lower === 'notes' || lower === 'note' || lower === 'description' || lower === 'memo' || lower === 'history') {
            initialMapping.notes = h;
          } else if (lower === 'birthday' || lower === 'bday' || lower === 'birthdate' || lower === 'birth') {
            initialMapping.birthday = h;
          }
        });

        // Ensure at least "name" gets mapped if possible, else map first column to name
        if (!initialMapping.name && headers.length > 0) {
          initialMapping.name = headers[0];
        }

        setFieldMapping(initialMapping);
        setStep(2);
      },
      error: (err) => {
        setParseError('An error occurred while parsing the CSV file: ' + err.message);
      }
    });
  };

  const handleFieldMapChange = (crmField: keyof ImportMapping, csvHeader: string) => {
    setFieldMapping(prev => ({
      ...prev,
      [crmField]: csvHeader
    }));
  };

  // Build mapped array and submit to API
  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) return;
    
    // Validation: Name column must be mapped
    if (!fieldMapping.name) {
      alert('The "Full Name" field must be mapped to proceed with the import.');
      return;
    }

    setImporting(true);
    setImportError(null);

    // Transform raw row objects into structured Contacts according to mapping
    const structuredContacts = parsedRows.map(row => {
      return {
        name: row[fieldMapping.name] || 'Unnamed Contact',
        phone: fieldMapping.phone ? row[fieldMapping.phone] : '',
        email: fieldMapping.email ? row[fieldMapping.email] : '',
        website: fieldMapping.website ? row[fieldMapping.website] : '',
        group_name: fieldMapping.group_name ? row[fieldMapping.group_name] : '',
        tags: fieldMapping.tags ? row[fieldMapping.tags] : '',
        address: fieldMapping.address ? row[fieldMapping.address] : '',
        company: fieldMapping.company ? row[fieldMapping.company] : '',
        job_title: fieldMapping.job_title ? row[fieldMapping.job_title] : '',
        notes: fieldMapping.notes ? row[fieldMapping.notes] : '',
        birthday: fieldMapping.birthday ? row[fieldMapping.birthday] : ''
      };
    });

    const tagsArray = defaultTags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    try {
      await syncManager.importContacts(structuredContacts, defaultGroup.trim(), tagsArray);
      setImportCount(structuredContacts.length);
      setStep(3);
    } catch (err: any) {
      setImportError(err.message || 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedHeaders([]);
    setParsedRows([]);
    setParseError(null);
    setFieldMapping({
      name: '', phone: '', email: '', website: '', group_name: '',
      tags: '', address: '', company: '', job_title: '', notes: '', birthday: ''
    });
    setDefaultGroup('');
    setDefaultTags('');
    setImportCount(null);
    setImportError(null);
    setStep(1);
  };

  // Render a preview of the first 3 contacts that will be generated
  const getPreviewContacts = () => {
    return parsedRows.slice(0, 3).map(row => {
      const rawTags = fieldMapping.tags ? row[fieldMapping.tags] : '';
      let combinedTagsList = rawTags 
        ? String(rawTags).split(',').map(t => t.trim()).filter(Boolean)
        : [];
      
      if (defaultTags) {
        defaultTags.split(',').forEach(dt => {
          const trimmed = dt.trim();
          if (trimmed && !combinedTagsList.includes(trimmed)) {
            combinedTagsList.push(trimmed);
          }
        });
      }

      return {
        name: row[fieldMapping.name] || 'Unnamed Contact',
        phone: fieldMapping.phone ? row[fieldMapping.phone] : '',
        email: fieldMapping.email ? row[fieldMapping.email] : '',
        group: (fieldMapping.group_name ? row[fieldMapping.group_name] : '') || defaultGroup,
        tags: combinedTagsList.join(', '),
        company: fieldMapping.company ? row[fieldMapping.company] : '',
        job_title: fieldMapping.job_title ? row[fieldMapping.job_title] : ''
      };
    });
  };

  const crmFieldsConfig: { key: keyof ImportMapping; label: string; required: boolean }[] = [
    { key: 'name', label: 'Full Name', required: true },
    { key: 'phone', label: 'Phone Number', required: false },
    { key: 'email', label: 'Email Address', required: false },
    { key: 'website', label: 'Website URL', required: false },
    { key: 'company', label: 'Company / Org', required: false },
    { key: 'job_title', label: 'Job Title / Role', required: false },
    { key: 'group_name', label: 'Primary Group', required: false },
    { key: 'tags', label: 'Tags List', required: false },
    { key: 'address', label: 'Physical Address', required: false },
    { key: 'birthday', label: 'Birthday', required: false },
    { key: 'notes', label: 'Biography / Notes', required: false },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50 flex flex-col h-full">
      
      {/* Header Info */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-slate-600" />
          <span>CSV Contact Importer</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Upload any standard spreadsheet in .csv format. Match your column headers to our database schema, and bulk load thousands of records instantly into SQLite.
        </p>
      </div>

      {/* Progress Tracker Stepper */}
      <div className="mb-6 bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between shadow-xs max-w-4xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
            step >= 1 ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'
          }`}>
            1
          </div>
          <span className={`text-xs font-semibold ${step >= 1 ? 'text-slate-900' : 'text-slate-400'}`}>Upload file</span>
        </div>
        <ArrowRight className="h-4 w-4 text-slate-300" />
        <div className="flex items-center gap-2">
          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
            step >= 2 ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'
          }`}>
            2
          </div>
          <span className={`text-xs font-semibold ${step >= 2 ? 'text-slate-900' : 'text-slate-400'}`}>Map fields & Defaults</span>
        </div>
        <ArrowRight className="h-4 w-4 text-slate-300" />
        <div className="flex items-center gap-2">
          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
            step >= 3 ? 'bg-green-700 text-white' : 'bg-slate-200 text-slate-500'
          }`}>
            3
          </div>
          <span className={`text-xs font-semibold ${step >= 3 ? 'text-green-800' : 'text-slate-400'}`}>Import completed</span>
        </div>
      </div>

      {/* Content Panels based on current Step */}
      <div className="flex-1 max-w-4xl mx-auto w-full">
        {step === 1 && (
          <div className="space-y-6">
            {/* Dropzone Container */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all flex flex-col items-center justify-center ${
                isDragActive 
                  ? 'border-slate-800 bg-slate-100/50 scale-[1.01]' 
                  : 'border-slate-300 bg-white hover:border-slate-400 hover:shadow-xs'
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".csv"
                className="hidden"
              />
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 mb-4">
                <Upload className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800">
                Drag & drop your CSV file here, or click to browse
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Supports only comma-separated .csv files. First row should contain the column headers.
              </p>
            </div>

            {/* Error view */}
            {parseError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 text-xs text-red-700 max-w-2xl mx-auto items-start">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold">Parsing Failure</h4>
                  <p className="mt-0.5 text-slate-600">{parseError}</p>
                </div>
              </div>
            )}

            {/* vCard instructions & helper info */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                CRM CSV Formatting Guide
              </h4>
              <p className="text-xs text-slate-600">
                To maximize mapping speed, we recommend naming your spreadsheet headers similar to:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono bg-slate-50 p-3 rounded-lg border border-slate-150">
                <div>• Name / Full Name</div>
                <div>• Phone / Mobile</div>
                <div>• Email / Address</div>
                <div>• Website / URL</div>
                <div>• Group / Folder</div>
                <div>• Tags / Labels</div>
                <div>• Company / Org</div>
                <div>• Job Title / Role</div>
              </div>
              <p className="text-xs text-slate-500 italic">
                Our smart parser automatically identifies standard variants and pre-fills mappings for you.
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Column Mapping & Defaults */}
              <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 space-y-6 shadow-xs">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 border-b border-slate-150 pb-2 flex items-center gap-1.5">
                    <Settings className="h-4 w-4 text-slate-500" />
                    <span>Map CSV Headers to CRM Database fields</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Select which column from your CSV file represents each CRM field. Leaving a selector empty is acceptable, except for Full Name.
                  </p>
                </div>

                <div className="space-y-3">
                  {crmFieldsConfig.map(field => {
                    const isMapped = !!fieldMapping[field.key];
                    return (
                      <div key={field.key} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-5 flex items-center gap-1">
                          <span className="text-xs font-semibold text-slate-700">{field.label}</span>
                          {field.required && <span className="text-red-500 font-bold">*</span>}
                        </div>
                        <div className="col-span-7 relative">
                          <select
                            id={`map-${field.key}-select`}
                            value={fieldMapping[field.key]}
                            onChange={(e) => handleFieldMapChange(field.key, e.target.value)}
                            className={`w-full px-3 py-1.5 text-xs bg-slate-50 border rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-400 ${
                              isMapped ? 'border-slate-300 font-medium text-slate-800 bg-emerald-50/20' : 'border-slate-200 text-slate-400'
                            }`}
                          >
                            <option value="">-- Ignored / Skip Field --</option>
                            {parsedHeaders.map(h => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                          {isMapped && (
                            <Check className="absolute right-6 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-green-600" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* APPEND DEFAULT CLASSIFICATIONS */}
                <div className="border-t border-slate-150 pt-4 space-y-4">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <ListPlus className="h-4 w-4 text-slate-400" />
                      <span>Append default labels to all contacts</span>
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Need to immediately sort this import? Apply a default group or append tags to every single incoming contact.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">Default Group</label>
                      <input
                        id="default-group-input"
                        type="text"
                        value={defaultGroup}
                        onChange={(e) => setDefaultGroup(e.target.value)}
                        placeholder="e.g. Imported Leads"
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-slate-400"
                      />
                      <span className="text-[9px] text-slate-400">Only applied if contact does not have a mapped group row.</span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">Default Tags (Comma-separated)</label>
                      <input
                        id="default-tags-input"
                        type="text"
                        value={defaultTags}
                        onChange={(e) => setDefaultTags(e.target.value)}
                        placeholder="e.g. bulk-import-2026, raw"
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-slate-400"
                      />
                      <span className="text-[9px] text-slate-400">These tags will be appended to every imported contact.</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Column: Dynamic Preview Grid */}
              <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 space-y-6 shadow-xs h-fit sticky top-24">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 border-b border-slate-150 pb-2 flex items-center gap-1.5">
                    <Eye className="h-4 w-4 text-slate-500" />
                    <span>Real-time Import Preview</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Showing how the first {Math.min(3, parsedRows.length)} rows will resolve inside the CRM database.
                  </p>
                </div>

                <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                  {getPreviewContacts().map((contact, index) => (
                    <div key={index} className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 space-y-2 text-xs">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                        <span className="font-bold text-slate-900 truncate pr-2">{contact.name}</span>
                        <span className="text-[9px] text-slate-400">Preview #{index + 1}</span>
                      </div>
                      
                      {contact.phone || contact.email ? (
                        <div className="text-slate-600 space-y-0.5 font-mono text-[10px]">
                          {contact.phone && <div>📞 {contact.phone}</div>}
                          {contact.email && <div>✉️ {contact.email}</div>}
                        </div>
                      ) : null}

                      {contact.company || contact.job_title ? (
                        <div className="text-slate-700 italic text-[11px]">
                          💼 {contact.job_title} {contact.company ? `at ${contact.company}` : ''}
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-1 pt-1 items-center">
                        {contact.group && (
                          <span className="bg-slate-200 text-slate-800 text-[9px] font-bold px-1.5 py-0.5 rounded-xs uppercase tracking-wide">
                            {contact.group}
                          </span>
                        )}
                        {contact.tags && contact.tags.split(',').map(tag => (
                          <span key={tag} className="bg-white border border-slate-250 text-slate-600 text-[9px] px-1.5 py-0.1 rounded-full">
                            {tag.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {importError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2 text-xs text-red-700">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold">Execution Error</h4>
                      <p className="mt-0.5">{importError}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleReset}
                    className="flex-1 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset</span>
                  </button>
                  <button
                    id="execute-import-btn"
                    onClick={handleExecuteImport}
                    disabled={importing || !fieldMapping.name}
                    className="flex-2 py-2 bg-slate-900 hover:bg-slate-850 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {importing ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        <span>Writing to SQLite...</span>
                      </>
                    ) : (
                      <>
                        <Database className="h-4 w-4" />
                        <span>Import {parsedRows.length} Contacts</span>
                      </>
                    )}
                  </button>
                </div>

              </div>

            </div>
          </div>
        )}

        {step === 3 && (
          <div className="max-w-md mx-auto bg-white rounded-xl border border-slate-200 p-8 text-center space-y-6 shadow-sm my-10">
            <div className="h-14 w-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-150">
              <Check className="h-7 w-7" />
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-bold text-slate-900">Import Successful!</h3>
              <p className="text-xs text-slate-500">
                A batch of <span className="font-bold text-slate-950">{importCount} contacts</span> has been successfully mapped, processed, and loaded into your SQLite database.
              </p>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 border border-slate-150 space-y-2 text-xs text-slate-600 text-left">
              <div className="flex justify-between">
                <span>Total records inserted:</span>
                <span className="font-bold text-slate-900">{importCount}</span>
              </div>
              {defaultGroup && (
                <div className="flex justify-between">
                  <span>Default Group applied:</span>
                  <span className="font-bold text-slate-900">{defaultGroup}</span>
                </div>
              )}
              {defaultTags && (
                <div className="flex justify-between items-start">
                  <span>Default Tags appended:</span>
                  <span className="font-bold text-slate-900 text-right max-w-[200px] truncate">{defaultTags}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="flex-1 py-2 border border-slate-200 rounded-lg text-xs text-slate-700 hover:bg-slate-50 transition-colors font-medium cursor-pointer"
              >
                Import another file
              </button>
              <button
                id="view-contacts-after-import-btn"
                onClick={onImportSuccess}
                className="flex-1 py-2 bg-slate-900 hover:bg-slate-850 text-white rounded-lg text-xs transition-all font-bold cursor-pointer"
              >
                View Contacts Book
              </button>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Contact } from '../types';
import { 
  Search, Users, Plus, Trash2, Tag, Folder, X, Check, Edit3, Info,
  Globe, Mail, Phone, MapPin, Briefcase, Calendar, Download, AlertCircle, Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { syncManager } from '../utils/syncManager';

interface ContactsScreenProps {
  onContactsChange?: () => void;
}

export default function ContactsScreen({ onContactsChange }: ContactsScreenProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters (Client & API assisted)
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGroupFilter, setActiveGroupFilter] = useState('');
  const [activeTagFilter, setActiveTagFilter] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 100;

  // Selection
  const [selectedIds, setSelectedIds] = useState<(number | string)[]>([]);

  // Bulk Selection assistant values
  const [quickSelectGroup, setQuickSelectGroup] = useState('');
  const [quickSelectTag, setQuickSelectTag] = useState('');

  // Modals / Editors
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [viewingContact, setViewingContact] = useState<Contact | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Bulk Edit Modals
  const [isBulkGroupModalOpen, setIsBulkGroupModalOpen] = useState(false);
  const [bulkGroupValue, setBulkGroupValue] = useState('');
  const [isBulkTagModalOpen, setIsBulkTagModalOpen] = useState(false);
  const [bulkTagValue, setBulkTagValue] = useState('');
  const [bulkTagAction, setBulkTagAction] = useState<'add' | 'remove'>('add');

  // Single Contact Form State (Used for both add and edit)
  const [contactForm, setContactForm] = useState<Omit<Contact, 'id' | 'created_at'>>({
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

  // Fetch all data using syncManager (which handles offline states automatically)
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const contactsData = await syncManager.getContacts({
        search: searchQuery,
        group: activeGroupFilter,
        tag: activeTagFilter
      });
      
      const groupsData = syncManager.getGroups();
      const tagsData = syncManager.getTags();

      setContacts(contactsData);
      setGroups(groupsData);
      setTags(tagsData);
    } catch (err: any) {
      setError(err.message || 'An error occurred while loading contacts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    fetchData();
  }, [searchQuery, activeGroupFilter, activeTagFilter]);

  // Set up listeners for background sync completion to refresh our UI dynamically
  useEffect(() => {
    const unsubscribeSync = syncManager.onSyncChange(() => {
      fetchData();
    });
    return () => unsubscribeSync();
  }, [searchQuery, activeGroupFilter, activeTagFilter]);

  // Clean selection if active contacts change
  useEffect(() => {
    const validIds = contacts.map(c => c.id).filter(id => id !== undefined);
    setSelectedIds(prev => prev.filter(id => validIds.includes(id)));
  }, [contacts]);

  const totalPages = Math.ceil(contacts.length / recordsPerPage);
  const currentRecords = contacts.slice(
    (currentPage - 1) * recordsPerPage,
    currentPage * recordsPerPage
  );

  const handleSelectAll = () => {
    const currentPageIds = currentRecords.map(c => c.id).filter((id): id is number | string => id !== undefined);
    const allSelectedOnPage = currentPageIds.every(id => selectedIds.includes(id));

    if (allSelectedOnPage) {
      setSelectedIds(prev => prev.filter(id => !currentPageIds.includes(id)));
    } else {
      setSelectedIds(prev => {
        const otherSelected = prev.filter(id => !currentPageIds.includes(id));
        return [...otherSelected, ...currentPageIds];
      });
    }
  };

  const handleSelectToggle = (id: number | string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Bulk Selection by Group / Tag (Assistant tool)
  const applyBulkSelectionByGroup = (groupName: string) => {
    if (!groupName) return;
    
    // Actually set the screen filter so only contacts of this group appear on the list!
    setActiveGroupFilter(groupName);

    const idsInGroup = contacts
      .filter(c => c.group_name && c.group_name.trim().toLowerCase() === groupName.trim().toLowerCase())
      .map(c => c.id)
      .filter(id => id !== undefined) as (number | string)[];
    
    // Union existing selections and group members
    setSelectedIds(prev => {
      const union = new Set([...prev, ...idsInGroup]);
      return Array.from(union);
    });
    setQuickSelectGroup('');
  };

  const applyBulkSelectionByTag = (tagName: string) => {
    if (!tagName) return;

    // Actually set the screen filter so only contacts of this tag appear on the list!
    setActiveTagFilter(tagName);

    const idsWithTag = contacts
      .filter(c => {
        const contactTags = c.tags ? c.tags.split(',').map(t => t.trim().toLowerCase()) : [];
        return contactTags.includes(tagName.trim().toLowerCase());
      })
      .map(c => c.id)
      .filter(id => id !== undefined) as (number | string)[];

    // Union
    setSelectedIds(prev => {
      const union = new Set([...prev, ...idsWithTag]);
      return Array.from(union);
    });
    setQuickSelectTag('');
  };

  // Bulk Actions
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete the ${selectedIds.length} selected contacts?`)) {
      return;
    }

    try {
      await syncManager.bulkDelete(selectedIds);
      setSelectedIds([]);
      fetchData();
      if (onContactsChange) onContactsChange();
    } catch (err: any) {
      alert(err.message || 'Failed to complete bulk delete.');
    }
  };

  const handleBulkUpdateGroup = async () => {
    try {
      await syncManager.bulkUpdateGroups(selectedIds, bulkGroupValue);
      setIsBulkGroupModalOpen(false);
      setBulkGroupValue('');
      setSelectedIds([]);
      fetchData();
      if (onContactsChange) onContactsChange();
    } catch (err: any) {
      alert(err.message || 'Failed to update groups.');
    }
  };

  const handleBulkUpdateTags = async () => {
    if (!bulkTagValue.trim()) return;
    const tagsArray = bulkTagValue.split(',').map(t => t.trim()).filter(Boolean);

    try {
      await syncManager.bulkUpdateTags(selectedIds, tagsArray, bulkTagAction);
      setIsBulkTagModalOpen(false);
      setBulkTagValue('');
      setSelectedIds([]);
      fetchData();
      if (onContactsChange) onContactsChange();
    } catch (err: any) {
      alert(err.message || 'Failed to update tags.');
    }
  };

  const handleBulkExportVCF = () => {
    if (selectedIds.length === 0) return;
    
    // Get all contacts that are currently selected
    const selectedContacts = contacts.filter(c => c.id !== undefined && selectedIds.includes(c.id));
    if (selectedContacts.length === 0) {
      alert('No matching contacts found to export.');
      return;
    }

    const vcards = selectedContacts.map(contact => {
      return [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${contact.name}`,
        contact.phone ? `TEL;TYPE=CELL:${contact.phone}` : '',
        contact.email ? `EMAIL;TYPE=INTERNET:${contact.email}` : '',
        contact.website ? `URL:${contact.website}` : '',
        contact.company ? `ORG:${contact.company}` : '',
        contact.job_title ? `TITLE:${contact.job_title}` : '',
        contact.address ? `ADR;TYPE=WORK:;;${contact.address.replace(/\n/g, ';')}` : '',
        contact.birthday ? `BDAY:${contact.birthday}` : '',
        contact.notes ? `NOTE:${contact.notes.replace(/\n/g, '\\n')}` : '',
        contact.group_name ? `CATEGORIES:${contact.group_name}${contact.tags ? ',' + contact.tags : ''}` : contact.tags ? `CATEGORIES:${contact.tags}` : '',
        'END:VCARD'
      ].filter(Boolean).join('\r\n');
    }).join('\r\n');

    const blob = new Blob([vcards], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    let filename = 'contacts_export.vcf';
    if (activeGroupFilter) {
      filename = `contacts_group_${activeGroupFilter.replace(/\s+/g, '_')}.vcf`;
    } else if (activeTagFilter) {
      filename = `contacts_tag_${activeTagFilter.replace(/\s+/g, '_')}.vcf`;
    } else if (selectedContacts.length === 1) {
      filename = `${selectedContacts[0].name.replace(/\s+/g, '_')}.vcf`;
    } else {
      filename = `contacts_export_${selectedContacts.length}.vcf`;
    }

    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Add Contact
  const handleAddContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name.trim()) return;

    try {
      await syncManager.createContact(contactForm);
      setIsAddModalOpen(false);
      setContactForm({
        name: '', phone: '', email: '', website: '', group_name: '',
        tags: '', address: '', company: '', job_title: '', notes: '', birthday: ''
      });
      fetchData();
      if (onContactsChange) onContactsChange();
    } catch (err: any) {
      alert(err.message || 'Failed to save contact.');
    }
  };

  // Edit Contact
  const handleEditContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingContact || !viewingContact.id) return;

    try {
      const updated = await syncManager.updateContact(viewingContact.id, {
        ...contactForm,
        id: viewingContact.id
      });
      setViewingContact(updated);
      setIsEditing(false);
      fetchData();
      if (onContactsChange) onContactsChange();
    } catch (err: any) {
      alert(err.message || 'Failed to save changes.');
    }
  };

  // Trigger editing a contact
  const startEditing = (contact: Contact) => {
    setContactForm({
      name: contact.name,
      phone: contact.phone || '',
      email: contact.email || '',
      website: contact.website || '',
      group_name: contact.group_name || '',
      tags: contact.tags || '',
      address: contact.address || '',
      company: contact.company || '',
      job_title: contact.job_title || '',
      notes: contact.notes || '',
      birthday: contact.birthday || ''
    });
    setIsEditing(true);
  };

  // Delete individual contact
  const deleteContact = async (id: number | string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;
    try {
      await syncManager.deleteContact(id);
      setViewingContact(null);
      fetchData();
      if (onContactsChange) onContactsChange();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Generate and download individual vCard
  const downloadVCard = (contact: Contact) => {
    const vcardContent = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${contact.name}`,
      contact.phone ? `TEL;TYPE=CELL:${contact.phone}` : '',
      contact.email ? `EMAIL;TYPE=INTERNET:${contact.email}` : '',
      contact.website ? `URL:${contact.website}` : '',
      contact.company ? `ORG:${contact.company}` : '',
      contact.job_title ? `TITLE:${contact.job_title}` : '',
      contact.address ? `ADR;TYPE=WORK:;;${contact.address.replace(/\n/g, ';')}` : '',
      contact.birthday ? `BDAY:${contact.birthday}` : '',
      contact.notes ? `NOTE:${contact.notes.replace(/\n/g, '\\n')}` : '',
      contact.group_name ? `CATEGORIES:${contact.group_name}${contact.tags ? ',' + contact.tags : ''}` : contact.tags ? `CATEGORIES:${contact.tags}` : '',
      'END:VCARD'
    ].filter(Boolean).join('\r\n');

    const blob = new Blob([vcardContent], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${contact.name.replace(/\s+/g, '_')}.vcf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Search and Quick Filters bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-xs px-4 py-3 md:px-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Main search and new button */}
          <div className="flex-1 flex gap-2 max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" id="search-icon" />
              <input
                id="search-input"
                type="text"
                placeholder="Search name, email, phone, tags, company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-100 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-400 focus:bg-white transition-all text-slate-800 placeholder-slate-400"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              id="add-contact-btn"
              onClick={() => {
                setContactForm({
                  name: '', phone: '', email: '', website: '', group_name: '',
                  tags: '', address: '', company: '', job_title: '', notes: '', birthday: ''
                });
                setIsAddModalOpen(true);
              }}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-850 text-white rounded-lg flex items-center gap-1.5 text-sm font-medium transition-all shadow-xs shrink-0 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add</span>
            </button>
          </div>

          {/* Screen Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            {/* Filter by Group */}
            <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-600">
              <Folder className="h-3 w-3 text-slate-400" />
              <select
                id="filter-group-select"
                value={activeGroupFilter}
                onChange={(e) => setActiveGroupFilter(e.target.value)}
                className="bg-transparent focus:outline-hidden font-medium text-slate-700 cursor-pointer"
              >
                <option value="">All Groups</option>
                {groups.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            {/* Filter by Tag */}
            <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-600">
              <Tag className="h-3 w-3 text-slate-400" />
              <select
                id="filter-tag-select"
                value={activeTagFilter}
                onChange={(e) => setActiveTagFilter(e.target.value)}
                className="bg-transparent focus:outline-hidden font-medium text-slate-700 cursor-pointer"
              >
                <option value="">All Tags</option>
                {tags.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Clear Filters helper */}
            {(activeGroupFilter || activeTagFilter) && (
              <button
                onClick={() => {
                  setActiveGroupFilter('');
                  setActiveTagFilter('');
                }}
                className="text-xs text-slate-500 hover:text-slate-800 font-medium underline cursor-pointer"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Bulk Selection Assistant Panel */}
        <div className="mt-3 flex flex-wrap gap-2 items-center border-t border-dashed border-slate-200 pt-2.5 text-xs">
          <span className="text-slate-500 font-medium">Bulk Selector Assistant:</span>
          
          <select
            id="quick-select-group"
            value={quickSelectGroup}
            onChange={(e) => {
              const val = e.target.value;
              setQuickSelectGroup(val);
              applyBulkSelectionByGroup(val);
            }}
            className="bg-white border border-slate-200 rounded-md px-2 py-1 text-slate-700 focus:outline-hidden text-xs cursor-pointer"
          >
            <option value="">+ Select group contacts...</option>
            {groups.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          <select
            id="quick-select-tag"
            value={quickSelectTag}
            onChange={(e) => {
              const val = e.target.value;
              setQuickSelectTag(val);
              applyBulkSelectionByTag(val);
            }}
            className="bg-white border border-slate-200 rounded-md px-2 py-1 text-slate-700 focus:outline-hidden text-xs cursor-pointer"
          >
            <option value="">+ Select tag contacts...</option>
            {tags.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {selectedIds.length > 0 && (
            <button
              onClick={() => setSelectedIds([])}
              className="text-slate-500 hover:text-red-500 ml-auto flex items-center gap-1 font-medium transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              <span>Deselect all ({selectedIds.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Floating/Sticky Bulk Operations Drawer */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="bg-slate-900 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-md z-20 border-b border-slate-850"
          >
            <div className="flex items-center gap-2">
              <span className="bg-slate-800 text-slate-200 text-xs font-bold px-2.5 py-1 rounded-full">
                {selectedIds.length} Selected
              </span>
              <p className="text-xs text-slate-350 hidden sm:inline-block">Contacts ready for bulk operations</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setBulkGroupValue('');
                  setIsBulkGroupModalOpen(true);
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Folder className="h-3.5 w-3.5" />
                <span>Change Group</span>
              </button>
              
              <button
                onClick={() => {
                  setBulkTagValue('');
                  setBulkTagAction('add');
                  setIsBulkTagModalOpen(true);
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Tag className="h-3.5 w-3.5" />
                <span>Adjust Tags</span>
              </button>

              <button
                onClick={handleBulkExportVCF}
                className="bg-emerald-700 hover:bg-emerald-600 text-white rounded-md px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export to VCF</span>
              </button>

              <button
                onClick={handleBulkDelete}
                className="bg-red-700 hover:bg-red-650 text-white rounded-md px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Bulk Delete</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contacts List Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
            <p className="mt-4 text-slate-500 text-sm">Querying SQLite DB...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center max-w-xl mx-auto my-10">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
            <h3 className="mt-2 text-sm font-semibold text-red-800">Database Connection Failed</h3>
            <p className="mt-1 text-xs text-red-600">{error}</p>
            <button 
              onClick={fetchData} 
              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-20 max-w-md mx-auto">
            <div className="bg-slate-100 rounded-full h-12 w-12 flex items-center justify-center mx-auto text-slate-400">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-slate-800">No contacts found</h3>
            <p className="mt-1 text-xs text-slate-500">
              {searchQuery || activeGroupFilter || activeTagFilter 
                ? "Try updating your search query or filters to find more results."
                : "Your SQLite contact book is empty. Add a contact or head over to the Import CSV tab!"}
            </p>
            {(searchQuery || activeGroupFilter || activeTagFilter) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setActiveGroupFilter('');
                  setActiveTagFilter('');
                }}
                className="mt-4 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 rounded-lg text-xs text-slate-700 font-medium transition-all cursor-pointer"
              >
                Reset Search Filters
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-slate-100 border-b border-slate-200 text-slate-500 font-semibold text-xs uppercase tracking-wider items-center">
              <div className="col-span-1 flex items-center justify-center">
                <input
                  id="select-all-checkbox"
                  type="checkbox"
                  checked={currentRecords.length > 0 && currentRecords.every(c => c.id !== undefined && selectedIds.includes(c.id))}
                  onChange={handleSelectAll}
                  className="rounded-sm border-slate-300 text-slate-900 focus:ring-slate-400 h-4 w-4 cursor-pointer"
                />
              </div>
              <div className="col-span-4 sm:col-span-3">Name</div>
              <div className="col-span-4 sm:col-span-3">Contact Details</div>
              <div className="col-span-3 sm:col-span-2 hidden sm:block">Company & Role</div>
              <div className="col-span-3 sm:col-span-2">Group & Tags</div>
              <div className="col-span-3 sm:col-span-1 text-right">Actions</div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-slate-100">
              {currentRecords.map((c) => {
                const isSelected = c.id !== undefined && selectedIds.includes(c.id);
                return (
                  <div 
                    key={c.id} 
                    className={`grid grid-cols-12 gap-3 px-4 py-3 items-center hover:bg-slate-50 transition-colors text-sm ${
                      isSelected ? 'bg-slate-50/70' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <div className="col-span-1 flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => c.id !== undefined && handleSelectToggle(c.id)}
                        className="rounded-sm border-slate-300 text-slate-900 focus:ring-slate-400 h-4 w-4 cursor-pointer"
                      />
                    </div>

                    {/* Name & Avatar */}
                    <div className="col-span-4 sm:col-span-3 flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 select-none">
                        {c.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <span 
                          onClick={() => setViewingContact(c)}
                          className="font-semibold text-slate-900 hover:underline cursor-pointer text-sm"
                        >
                          {c.name}
                        </span>
                      </div>
                    </div>

                    {/* Contact Details */}
                    <div className="col-span-4 sm:col-span-3 flex flex-col gap-0.5 text-xs text-slate-600 truncate">
                      {c.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3 shrink-0 text-slate-400" />
                          <span className="truncate">{c.phone}</span>
                        </span>
                      )}
                      {c.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3 shrink-0 text-slate-400" />
                          <span className="truncate">{c.email}</span>
                        </span>
                      )}
                    </div>

                    {/* Company & Role */}
                    <div className="col-span-3 sm:col-span-2 hidden sm:flex flex-col gap-0.5 text-xs truncate">
                      {c.company && (
                        <span className="font-medium text-slate-800 flex items-center gap-1">
                          <Briefcase className="h-3 w-3 text-slate-400" />
                          <span className="truncate">{c.company}</span>
                        </span>
                      )}
                      {c.job_title && (
                        <span className="text-slate-500 truncate">{c.job_title}</span>
                      )}
                    </div>

                    {/* Group & Tags */}
                    <div className="col-span-3 sm:col-span-2 flex flex-col gap-1.5">
                      {c.group_name && (
                        <button
                          onClick={() => setActiveGroupFilter(c.group_name)}
                          title={`Filter contacts by group: ${c.group_name}`}
                          className="inline-flex items-center gap-1 w-fit bg-slate-100 hover:bg-teal-500/15 text-slate-800 hover:text-teal-700 text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wide cursor-pointer transition-colors border border-transparent hover:border-teal-500/20"
                        >
                          <Folder className="h-2.5 w-2.5 text-slate-400" />
                          {c.group_name}
                        </button>
                      )}
                      {c.tags && (
                        <div className="flex flex-wrap gap-1">
                          {c.tags.split(',').map(tag => {
                            const trimmed = tag.trim();
                            if (!trimmed) return null;
                            return (
                              <button
                                key={trimmed}
                                onClick={() => setActiveTagFilter(trimmed)}
                                title={`Filter contacts by tag: ${trimmed}`}
                                className="bg-white border border-slate-250 hover:bg-teal-500/10 hover:border-teal-500/30 hover:text-teal-600 text-slate-600 text-[10px] px-1.5 py-0.5 rounded-full cursor-pointer transition-colors"
                              >
                                {trimmed}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="col-span-3 sm:col-span-1 text-right flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => {
                          setViewingContact(c);
                          setIsEditing(false);
                        }}
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-all cursor-pointer"
                        title="View contact"
                      >
                        <Info className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setViewingContact(c);
                          startEditing(c);
                        }}
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-all cursor-pointer"
                        title="Edit contact"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-4 py-3 bg-slate-550 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                <div className="font-medium">
                  Showing <span className="font-semibold text-slate-700">{(currentPage - 1) * recordsPerPage + 1}</span> to{' '}
                  <span className="font-semibold text-slate-700">
                    {Math.min(currentPage * recordsPerPage, contacts.length)}
                  </span>{' '}
                  of <span className="font-semibold text-slate-700">{contacts.length}</span> records
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none font-medium cursor-pointer transition-all"
                  >
                    Previous
                  </button>
                  
                  {/* Page Numbers */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                      // If there are many pages, only show around the current page
                      if (totalPages > 6) {
                        if (pageNum !== 1 && pageNum !== totalPages && Math.abs(pageNum - currentPage) > 1) {
                          if (pageNum === 2 && currentPage > 3) {
                            return <span key="ellipsis1" className="px-1 text-slate-400 select-none">...</span>;
                          }
                          if (pageNum === totalPages - 1 && currentPage < totalPages - 2) {
                            return <span key="ellipsis2" className="px-1 text-slate-400 select-none">...</span>;
                          }
                          return null;
                        }
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                            currentPage === pageNum
                              ? 'bg-teal-500/15 border border-teal-500/30 text-teal-600 font-bold'
                              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none font-medium cursor-pointer transition-all"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- ADD NEW CONTACT MODAL --- */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-550 bg-slate-900 text-white">
                <h3 className="text-base font-semibold">Add New Contact</h3>
                <button 
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-slate-400 hover:text-white transition-all cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleAddContactSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Name & Primary Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={contactForm.name}
                      onChange={(e) => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-400 focus:bg-white"
                      placeholder="e.g. Alice Smith"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={contactForm.phone}
                      onChange={(e) => setContactForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-400 focus:bg-white"
                      placeholder="e.g. +1 (555) 123-4567"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={contactForm.email}
                      onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-400 focus:bg-white"
                      placeholder="e.g. alice@alphacorp.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Website URL</label>
                    <input
                      type="url"
                      value={contactForm.website}
                      onChange={(e) => setContactForm(prev => ({ ...prev, website: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-400 focus:bg-white"
                      placeholder="e.g. https://alphacorp.com"
                    />
                  </div>
                </div>

                {/* CRM Metadata */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Group (Primary Folder)</label>
                    <input
                      type="text"
                      value={contactForm.group_name}
                      onChange={(e) => setContactForm(prev => ({ ...prev, group_name: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-400 focus:bg-white"
                      placeholder="e.g. Customers, Leads, Partners"
                      list="add-groups-datalist"
                    />
                    <datalist id="add-groups-datalist">
                      {groups.map(g => <option key={g} value={g} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Tags (Comma-separated)</label>
                    <input
                      type="text"
                      value={contactForm.tags}
                      onChange={(e) => setContactForm(prev => ({ ...prev, tags: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-400 focus:bg-white"
                      placeholder="e.g. vip, tech, conference-2026"
                    />
                  </div>
                </div>

                {/* Company & Role */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Company / Organization</label>
                    <input
                      type="text"
                      value={contactForm.company}
                      onChange={(e) => setContactForm(prev => ({ ...prev, company: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-400 focus:bg-white"
                      placeholder="e.g. Alpha Corp"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Job Title</label>
                    <input
                      type="text"
                      value={contactForm.job_title}
                      onChange={(e) => setContactForm(prev => ({ ...prev, job_title: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-400 focus:bg-white"
                      placeholder="e.g. Sales Director"
                    />
                  </div>
                </div>

                {/* Secondary details */}
                <div className="space-y-4 border-t border-slate-100 pt-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Physical Address</label>
                    <input
                      type="text"
                      value={contactForm.address}
                      onChange={(e) => setContactForm(prev => ({ ...prev, address: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-400 focus:bg-white"
                      placeholder="e.g. 123 Main St, New York, NY"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Birthday</label>
                      <input
                        type="date"
                        value={contactForm.birthday}
                        onChange={(e) => setContactForm(prev => ({ ...prev, birthday: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-400 focus:bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">CRM Notes</label>
                    <textarea
                      rows={3}
                      value={contactForm.notes}
                      onChange={(e) => setContactForm(prev => ({ ...prev, notes: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-400 focus:bg-white resize-none"
                      placeholder="Add conversation history, milestones, or helpful CRM notes here..."
                    />
                  </div>
                </div>

                {/* Submit button */}
                <div className="border-t border-slate-200 pt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-850 text-white rounded-lg text-sm font-semibold cursor-pointer"
                  >
                    Create Contact
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- DETAIL / EDIT MODAL & SIDEBAR --- */}
      <AnimatePresence>
        {viewingContact && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-slate-850 border border-slate-700 text-white flex items-center justify-center font-bold text-sm">
                    {viewingContact.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold">{viewingContact.name}</h3>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                      {viewingContact.group_name || 'No Group'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => downloadVCard(viewingContact)}
                    className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="Export vCard (.vcf)"
                  >
                    <Download className="h-4.5 w-4.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (isEditing) {
                        setIsEditing(false);
                      } else {
                        startEditing(viewingContact);
                      }
                    }}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      isEditing ? 'bg-slate-800 text-white' : 'hover:bg-slate-800 text-slate-300 hover:text-white'
                    }`}
                    title="Edit Details"
                  >
                    <Edit3 className="h-4.5 w-4.5" />
                  </button>
                  <button
                    onClick={() => viewingContact.id !== undefined && deleteContact(viewingContact.id)}
                    className="p-1.5 hover:bg-slate-800 text-red-400 hover:text-red-350 rounded-lg transition-colors cursor-pointer"
                    title="Delete contact"
                  >
                    <Trash2 className="h-4.5 w-4.5" />
                  </button>
                  <button
                    onClick={() => {
                      setViewingContact(null);
                      setIsEditing(false);
                    }}
                    className="text-slate-400 hover:text-white ml-2 cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Content Panel (Forms or Details view) */}
              <div className="flex-1 overflow-y-auto p-6">
                {isEditing ? (
                  <form onSubmit={handleEditContactSubmit} className="space-y-4">
                    {/* Name & Primary Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Full Name *</label>
                        <input
                          type="text"
                          required
                          value={contactForm.name}
                          onChange={(e) => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-400 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Phone Number</label>
                        <input
                          type="text"
                          value={contactForm.phone}
                          onChange={(e) => setContactForm(prev => ({ ...prev, phone: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-400 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Email Address</label>
                        <input
                          type="email"
                          value={contactForm.email}
                          onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-400 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Website URL</label>
                        <input
                          type="url"
                          value={contactForm.website}
                          onChange={(e) => setContactForm(prev => ({ ...prev, website: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-400 focus:bg-white"
                        />
                      </div>
                    </div>

                    {/* CRM Metadata */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Group (Primary Folder)</label>
                        <input
                          type="text"
                          value={contactForm.group_name}
                          onChange={(e) => setContactForm(prev => ({ ...prev, group_name: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-400 focus:bg-white"
                          list="edit-groups-datalist"
                        />
                        <datalist id="edit-groups-datalist">
                          {groups.map(g => <option key={g} value={g} />)}
                        </datalist>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Tags (Comma-separated)</label>
                        <input
                          type="text"
                          value={contactForm.tags}
                          onChange={(e) => setContactForm(prev => ({ ...prev, tags: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-400 focus:bg-white"
                        />
                      </div>
                    </div>

                    {/* Company & Role */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Company / Organization</label>
                        <input
                          type="text"
                          value={contactForm.company}
                          onChange={(e) => setContactForm(prev => ({ ...prev, company: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-400 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Job Title</label>
                        <input
                          type="text"
                          value={contactForm.job_title}
                          onChange={(e) => setContactForm(prev => ({ ...prev, job_title: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-400 focus:bg-white"
                        />
                      </div>
                    </div>

                    {/* Secondary details */}
                    <div className="space-y-4 border-t border-slate-100 pt-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Physical Address</label>
                        <input
                          type="text"
                          value={contactForm.address}
                          onChange={(e) => setContactForm(prev => ({ ...prev, address: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-400 focus:bg-white"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Birthday</label>
                          <input
                            type="date"
                            value={contactForm.birthday}
                            onChange={(e) => setContactForm(prev => ({ ...prev, birthday: e.target.value }))}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-400 focus:bg-white"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">CRM Notes</label>
                        <textarea
                          rows={3}
                          value={contactForm.notes}
                          onChange={(e) => setContactForm(prev => ({ ...prev, notes: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-400 focus:bg-white resize-none"
                        />
                      </div>
                    </div>

                    {/* Submit buttons */}
                    <div className="border-t border-slate-200 pt-4 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        Discard Changes
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-850 text-white rounded-lg text-sm font-semibold cursor-pointer"
                      >
                        Save Changes
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-6">
                    {/* Primary Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Left: Communication Channels */}
                      <div className="space-y-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1.5">
                          Communication Channels
                        </h4>
                        
                        <div className="flex items-start gap-3">
                          <Phone className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="block text-[10px] font-bold text-slate-400 uppercase">Phone Number</span>
                            {viewingContact.phone ? (
                              <a href={`tel:${viewingContact.phone}`} className="text-slate-800 hover:underline text-sm font-medium">
                                {viewingContact.phone}
                              </a>
                            ) : (
                              <span className="text-sm text-slate-400 italic">Not provided</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <Mail className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="block text-[10px] font-bold text-slate-400 uppercase">Email Address</span>
                            {viewingContact.email ? (
                              <a href={`mailto:${viewingContact.email}`} className="text-slate-800 hover:underline text-sm font-medium">
                                {viewingContact.email}
                              </a>
                            ) : (
                              <span className="text-sm text-slate-400 italic">Not provided</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <Globe className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="block text-[10px] font-bold text-slate-400 uppercase">Website</span>
                            {viewingContact.website ? (
                              <a 
                                href={viewingContact.website.startsWith('http') ? viewingContact.website : `https://${viewingContact.website}`} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-slate-800 hover:underline text-sm font-medium flex items-center gap-1"
                              >
                                {viewingContact.website}
                              </a>
                            ) : (
                              <span className="text-sm text-slate-400 italic">Not provided</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Work profile */}
                      <div className="space-y-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1.5">
                          Professional Profile
                        </h4>

                        <div className="flex items-start gap-3">
                          <Briefcase className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="block text-[10px] font-bold text-slate-400 uppercase">Company</span>
                            <span className="text-sm text-slate-800 font-semibold">
                              {viewingContact.company || <span className="text-slate-400 italic font-normal">Self-employed / Private</span>}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <Users className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="block text-[10px] font-bold text-slate-400 uppercase">Job Title</span>
                            <span className="text-sm text-slate-700">
                              {viewingContact.job_title || <span className="text-slate-400 italic">Not specified</span>}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <Calendar className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="block text-[10px] font-bold text-slate-400 uppercase">Birthday</span>
                            <span className="text-sm text-slate-700">
                              {viewingContact.birthday || <span className="text-slate-400 italic">Not set</span>}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Metadata Section (Group & Tags) */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                        CRM Classification
                      </h4>
                      <div className="space-y-3 text-xs">
                        <div>
                          <span className="text-slate-400 font-semibold mr-2">Primary Folder / Group:</span>
                          {viewingContact.group_name ? (
                            <button
                              onClick={() => {
                                setActiveGroupFilter(viewingContact.group_name);
                                setViewingContact(null);
                              }}
                              title={`Filter by group: ${viewingContact.group_name}`}
                              className="bg-slate-200 hover:bg-teal-500/15 hover:text-teal-700 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wide cursor-pointer transition-colors border border-transparent hover:border-teal-500/20"
                            >
                              {viewingContact.group_name}
                            </button>
                          ) : (
                            <span className="text-slate-400 italic">None</span>
                          )}
                        </div>
                        <div>
                          <span className="text-slate-400 font-semibold mr-2">Categorized Tags:</span>
                          {viewingContact.tags ? (
                            <div className="inline-flex flex-wrap gap-1 align-middle">
                              {viewingContact.tags.split(',').map(t => {
                                const trimmed = t.trim();
                                if (!trimmed) return null;
                                return (
                                  <button
                                    key={trimmed}
                                    onClick={() => {
                                      setActiveTagFilter(trimmed);
                                      setViewingContact(null);
                                    }}
                                    title={`Filter by tag: ${trimmed}`}
                                    className="bg-white border border-slate-250 hover:bg-teal-500/10 hover:border-teal-500/30 hover:text-teal-600 text-slate-700 text-[10px] px-2 py-0.5 rounded-full cursor-pointer transition-colors"
                                  >
                                    {trimmed}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">No tags attached</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Physical Address */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1.5">
                        Physical Location
                      </h4>
                      <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                        <div>
                          {viewingContact.address ? (
                            <p className="text-sm text-slate-800 font-medium whitespace-pre-wrap">
                              {viewingContact.address}
                            </p>
                          ) : (
                            <p className="text-sm text-slate-400 italic">No address provided</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* CRM Notes */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1.5">
                        Notes & Conversation Log
                      </h4>
                      <div className="bg-amber-50/50 border border-amber-100/70 rounded-lg p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {viewingContact.notes ? viewingContact.notes : (
                          <span className="text-slate-400 italic">No notes created yet. Click edit to add custom insights, deal stages, or chat histories.</span>
                        )}
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-400 flex items-center justify-between border-t border-slate-100 pt-4">
                      <span>Database ID: #{viewingContact.id}</span>
                      <span>Added: {viewingContact.created_at ? new Date(viewingContact.created_at).toLocaleString() : 'Just now'}</span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- BULK CHANGE GROUP MODAL --- */}
      <AnimatePresence>
        {isBulkGroupModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-lg border border-slate-200 w-full max-w-md overflow-hidden"
            >
              <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider">Change Group in Bulk</h3>
                <button onClick={() => setIsBulkGroupModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-xs text-slate-600">
                  Assign the <span className="font-bold text-slate-900">{selectedIds.length} selected contacts</span> to a primary group:
                </p>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Group Name</label>
                  <input
                    type="text"
                    value={bulkGroupValue}
                    onChange={(e) => setBulkGroupValue(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-400 focus:bg-white"
                    placeholder="e.g. Customers, Partners, Hot-Leads"
                    list="bulk-groups-datalist"
                  />
                  <datalist id="bulk-groups-datalist">
                    {groups.map(g => <option key={g} value={g} />)}
                  </datalist>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setIsBulkGroupModalOpen(false)}
                    className="px-3 py-1.5 border border-slate-200 rounded-md text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkUpdateGroup}
                    className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold cursor-pointer"
                  >
                    Apply Bulk Group
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- BULK ADJUST TAGS MODAL --- */}
      <AnimatePresence>
        {isBulkTagModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-lg border border-slate-200 w-full max-w-md overflow-hidden"
            >
              <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider">Adjust Tags in Bulk</h3>
                <button onClick={() => setIsBulkTagModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <p className="text-xs text-slate-600">
                  Perform tag adjustment on the <span className="font-bold text-slate-900">{selectedIds.length} selected contacts</span>:
                </p>
                
                {/* Action Selector */}
                <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-lg">
                  <button
                    onClick={() => setBulkTagAction('add')}
                    className={`py-1 rounded-md text-xs font-semibold cursor-pointer ${
                      bulkTagAction === 'add' ? 'bg-white shadow-xs text-slate-950' : 'text-slate-500 hover:text-slate-850'
                    }`}
                  >
                    Add Tags
                  </button>
                  <button
                    onClick={() => setBulkTagAction('remove')}
                    className={`py-1 rounded-md text-xs font-semibold cursor-pointer ${
                      bulkTagAction === 'remove' ? 'bg-white shadow-xs text-slate-950' : 'text-slate-500 hover:text-slate-850'
                    }`}
                  >
                    Remove Tags
                  </button>
                  <button
                    onClick={() => setBulkTagAction('set')}
                    className={`py-1 rounded-md text-xs font-semibold cursor-pointer ${
                      bulkTagAction === 'set' ? 'bg-white shadow-xs text-slate-950' : 'text-slate-500 hover:text-slate-850'
                    }`}
                  >
                    Overwrite Set
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    Tags (Comma-separated)
                  </label>
                  <input
                    type="text"
                    value={bulkTagValue}
                    onChange={(e) => setBulkTagValue(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-400 focus:bg-white"
                    placeholder="e.g. vip, follow-up, met-at-conf"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    {bulkTagAction === 'add' && 'These tags will be appended without duplicates.'}
                    {bulkTagAction === 'remove' && 'These tags will be stripped from selected contacts.'}
                    {bulkTagAction === 'set' && 'This will replace any existing tags on selected contacts.'}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setIsBulkTagModalOpen(false)}
                    className="px-3 py-1.5 border border-slate-200 rounded-md text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkUpdateTags}
                    className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold cursor-pointer"
                  >
                    Apply Bulk Tags
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

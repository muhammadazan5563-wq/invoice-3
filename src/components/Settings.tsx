import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  ArrowLeft,
  Save,
  FileSpreadsheet,
  Palette,
  Link2,
  CheckCircle,
  AlertCircle,
  Upload,
  Trash2,
  Building2,
  CreditCard,
  FileText,
  RefreshCw,
  MapPin,
} from 'lucide-react';
import {
  InvoiceTemplate,
  SpreadsheetSettings,
  getUserSettings,
  saveSpreadsheetSettings,
  saveInvoiceTemplate,
  getTemplateWithDefaults,
  getSpreadsheetWithDefaults,
} from '../lib/settings';
import { getSpreadsheetInfo } from '../lib/sheets';
import { refreshGoogleToken } from '../lib/auth';

interface SettingsProps {
  user: User;
  token: string;
  onClose: () => void;
  onSettingsSaved?: (newToken?: string) => void; // Callback to refresh parent state after save
}

type SettingsTab = 'spreadsheet' | 'template';

export default function Settings({ user, token, onClose, onSettingsSaved }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('spreadsheet');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentToken, setCurrentToken] = useState(token);

  // Spreadsheet settings
  const [spreadsheetUrl, setSpreadsheetUrl] = useState('');
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [sheetName, setSheetName] = useState('');
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [spreadsheetTitle, setSpreadsheetTitle] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Template settings
  const [companyName, setCompanyName] = useState('FAIZ GROUP');
  const [companyLogo, setCompanyLogo] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [paymentDetails, setPaymentDetails] = useState('');
  const [defaultHotelName, setDefaultHotelName] = useState('');
  const [defaultNotes, setDefaultNotes] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [timezone, setTimezone] = useState('UTC');
  const [taxRate, setTaxRate] = useState(0);
  const [contactPhone, setContactPhone] = useState('123-456-7890');
  const [contactEmail, setContactEmail] = useState('billing@finnova.com');
  const [contactAddress, setContactAddress] = useState('123 Anywhere St., Any City');
  const [tagline, setTagline] = useState('Smart Finances, Better Business');

  // Load existing settings
  useEffect(() => {
    loadSettings();
  }, []);

  // Keep currentToken in sync with prop
  useEffect(() => {
    setCurrentToken(token);
  }, [token]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const settings = await getUserSettings(user.uid);
      if (settings) {
        // Load spreadsheet settings
        const ss = getSpreadsheetWithDefaults(settings.spreadsheet_settings);
        setSpreadsheetUrl(ss.spreadsheetUrl);
        setSpreadsheetId(ss.spreadsheetId);
        setSheetName(ss.sheetName);

        // Load template settings
        const tmpl = getTemplateWithDefaults(settings.invoice_template);
        setCompanyName(tmpl.companyName);
        setCompanyLogo(tmpl.companyLogo);
        setTermsAndConditions(tmpl.termsAndConditions);
        setPaymentDetails(tmpl.paymentDetails);
        setDefaultHotelName(tmpl.defaultHotelName);
        setDefaultNotes(tmpl.defaultNotes);
        setCurrency(tmpl.currency);
        setTimezone(tmpl.timezone || 'UTC');
        setTaxRate(tmpl.taxRate);
        setContactPhone(tmpl.contactPhone || '123-456-7890');
        setContactEmail(tmpl.contactEmail || 'billing@finnova.com');
        setContactAddress(tmpl.contactAddress || '123 Anywhere St., Any City');
        setTagline(tmpl.tagline || 'Smart Finances, Better Business');
      } else {
        // Use defaults
        const tmpl = getTemplateWithDefaults(null);
        setCompanyName(tmpl.companyName);
        setTermsAndConditions(tmpl.termsAndConditions);
        setPaymentDetails(tmpl.paymentDetails);
        setCurrency(tmpl.currency);
        setContactPhone(tmpl.contactPhone || '123-456-7890');
        setContactEmail(tmpl.contactEmail || 'billing@finnova.com');
        setContactAddress(tmpl.contactAddress || '123 Anywhere St., Any City');
        setTagline(tmpl.tagline || 'Smart Finances, Better Business');
      }
    } catch (err: any) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  // Helper to get a valid token, refreshing if needed
  const getValidToken = async (): Promise<string> => {
    // Try the current token first by making a lightweight validation
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + encodeURIComponent(currentToken));
      if (response.ok) {
        const data = await response.json();
        if (data.scope && data.scope.includes('spreadsheets')) {
          return currentToken;
        }
      }
    } catch {
      // Token validation failed, try to refresh
    }

    // Token is invalid or expired, re-authenticate
    const newToken = await refreshGoogleToken();
    if (!newToken) {
      throw new Error('Failed to authenticate with Google. Please try signing in again.');
    }
    setCurrentToken(newToken);
    // Notify parent about the new token
    if (onSettingsSaved) {
      onSettingsSaved(newToken);
    }
    return newToken;
  };

  // Fetch and verify spreadsheet - handles re-auth automatically
  const handleFetchSpreadsheet = async () => {
    if (!spreadsheetUrl.trim()) {
      setError('Please enter a spreadsheet URL or ID');
      return;
    }

    setVerifying(true);
    setError(null);
    try {
      const validToken = await getValidToken();

      const input = spreadsheetUrl.trim();
      let extractedId = input;
      if (input.includes('docs.google.com/spreadsheets')) {
        const matches = input.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (matches && matches[1]) {
          extractedId = matches[1];
        }
      }

      const info = await getSpreadsheetInfo(extractedId, validToken);
      setSpreadsheetId(info.id);
      setSpreadsheetTitle(info.title);
      setAvailableSheets(info.sheets);
      if (info.sheets.length > 0 && !sheetName) {
        setSheetName(info.sheets[0]);
      }
      setSaveSuccess('Spreadsheet fetched successfully! Select a sheet tab below.');
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: any) {
      if (err.message?.includes('authentication') || err.message?.includes('401') || err.message?.includes('403')) {
        setError('Authentication expired. Attempting to re-authenticate...');
        // Try one more time with a fresh token
        try {
          const freshToken = await refreshGoogleToken();
          if (freshToken) {
            setCurrentToken(freshToken);
            if (onSettingsSaved) {
              onSettingsSaved(freshToken);
            }
            // Retry the fetch
            const input = spreadsheetUrl.trim();
            let extractedId = input;
            if (input.includes('docs.google.com/spreadsheets')) {
              const matches = input.match(/\/d\/([a-zA-Z0-9-_]+)/);
              if (matches && matches[1]) {
                extractedId = matches[1];
              }
            }
            const info = await getSpreadsheetInfo(extractedId, freshToken);
            setSpreadsheetId(info.id);
            setSpreadsheetTitle(info.title);
            setAvailableSheets(info.sheets);
            if (info.sheets.length > 0 && !sheetName) {
              setSheetName(info.sheets[0]);
            }
            setError(null);
            setSaveSuccess('Re-authenticated and spreadsheet fetched successfully!');
            setTimeout(() => setSaveSuccess(null), 4000);
          } else {
            setError('Could not re-authenticate. Please log out and log in again.');
          }
        } catch (retryErr: any) {
          setError('Authentication failed. Please log out and log in again to reconnect Google Sheets.');
        }
      } else {
        setError(err.message || 'Failed to fetch spreadsheet. Make sure you have access and the URL is correct.');
      }
    } finally {
      setVerifying(false);
    }
  };

  // Save spreadsheet settings
  const handleSaveSpreadsheet = async () => {
    if (!spreadsheetId) {
      setError('Please fetch and verify a spreadsheet first');
      return;
    }
    if (!sheetName) {
      setError('Please select a sheet tab');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const settings: SpreadsheetSettings = {
        spreadsheetId,
        spreadsheetUrl: spreadsheetUrl.trim(),
        sheetName,
        lastSynced: new Date().toISOString(),
      };
      await saveSpreadsheetSettings(user.uid, settings);
      setSaveSuccess('Spreadsheet settings saved and connected!');
      setTimeout(() => setSaveSuccess(null), 3000);
      // Notify parent to refresh settings
      if (onSettingsSaved) {
        onSettingsSaved();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save spreadsheet settings');
    } finally {
      setSaving(false);
    }
  };

  // Save template settings
  const handleSaveTemplate = async () => {
    setSaving(true);
    setError(null);
    try {
      const template: InvoiceTemplate = {
        companyName: companyName.trim(),
        companyLogo,
        termsAndConditions: termsAndConditions.trim(),
        paymentDetails: paymentDetails.trim(),
        defaultHotelName: defaultHotelName.trim(),
        defaultNotes: defaultNotes.trim(),
        currency,
        timezone,
        taxRate,
        contactPhone: contactPhone.trim(),
        contactEmail: contactEmail.trim(),
        contactAddress: contactAddress.trim(),
        tagline: tagline.trim(),
      };
      await saveInvoiceTemplate(user.uid, template);
      setSaveSuccess('Invoice template saved!');
      setTimeout(() => setSaveSuccess(null), 3000);
      // Notify parent to refresh template settings
      if (onSettingsSaved) {
        onSettingsSaved();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save template settings');
    } finally {
      setSaving(false);
    }
  };

  // Handle logo upload (base64)
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('Logo file must be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCompanyLogo(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mist">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-slate-300 border-t-blue-500 rounded-full animate-spin"></div>
          <p className="text-xs font-semibold text-quill">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mist/50" id="settings-root">
      {/* Header */}
      <header className="bg-shell border-b border-hairline sticky top-0 z-40 px-6 py-4">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 text-quill hover:text-ink text-sm font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-lg font-extrabold text-ink tracking-tight">Settings</h1>
              <p className="text-xs text-quill-soft font-medium">
                Configure your spreadsheet, invoice template & defaults
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Success/Error Messages */}
        {saveSuccess && (
          <div className="mb-6 bg-emerald-50 text-emerald-700 border border-emerald-100 p-4 rounded-[20px] text-sm font-medium flex items-center gap-2 animate-fade-in">
            <CheckCircle className="w-4 h-4" /> {saveSuccess}
          </div>
        )}
        {error && (
          <div className="mb-6 bg-red-50 text-red-600 border border-red-100 p-4 rounded-[20px] text-sm font-medium flex items-center gap-2 animate-fade-in">
            <AlertCircle className="w-4 h-4" /> {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-8 border-b border-hairline pb-4">
          <button
            onClick={() => setActiveTab('spreadsheet')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'spreadsheet'
                ? 'bg-brand text-white shadow-md'
                : 'bg-shell text-quill border border-hairline hover:bg-mist'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" /> Spreadsheet Account
          </button>
          <button
            onClick={() => setActiveTab('template')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'template'
                ? 'bg-brand text-white shadow-md'
                : 'bg-shell text-quill border border-hairline hover:bg-mist'
            }`}
          >
            <Palette className="w-4 h-4" /> Invoice Template
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'spreadsheet' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-shell rounded-[26px] border border-hairline shadow-sm p-6 lg:p-8 space-y-6">
              <div>
                <h2 className="text-base font-extrabold text-ink flex items-center gap-2">
                  <Link2 className="w-5 h-5 text-brand" /> Connect Google Spreadsheet
                </h2>
                <p className="text-xs text-quill mt-1">
                  Link your Google Sheets spreadsheet to sync invoices. Paste the full URL below and click "Fetch Sheets" to connect.
                </p>
              </div>

              {/* Spreadsheet URL Input */}
              <div>
                <label className="block text-xs font-bold text-quill uppercase tracking-wider mb-2">
                  Spreadsheet URL or ID
                </label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={spreadsheetUrl}
                    onChange={(e) => setSpreadsheetUrl(e.target.value)}
                    className="flex-1 bg-mist border border-hairline focus:bg-shell focus:bg-mist-2 rounded-xl px-4 py-3 text-ink placeholder:text-quill-soft focus:outline-none transition-all text-sm"
                    placeholder="https://docs.google.com/spreadsheets/d/your-spreadsheet-id/edit"
                  />
                  <button
                    onClick={handleFetchSpreadsheet}
                    disabled={verifying || !spreadsheetUrl.trim()}
                    className="flex items-center gap-2 bg-brand hover:bg-brand-mid disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-3 rounded-xl text-xs font-bold transition-colors shadow-sm"
                  >
                    {verifying ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Fetching...
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        Fetch Sheets
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-quill-soft mt-2">
                  If your session has expired, clicking "Fetch Sheets" will automatically re-authenticate with Google.
                </p>
              </div>

              {/* Spreadsheet Info */}
              {spreadsheetTitle && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 space-y-2">
                  <p className="text-sm font-bold text-emerald-800">✓ Connected: {spreadsheetTitle}</p>
                  <p className="text-xs text-emerald-600">ID: {spreadsheetId}</p>
                </div>
              )}

              {/* Sheet Selection */}
              {availableSheets.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-quill uppercase tracking-wider mb-2">
                    Select Sheet Tab
                  </label>
                  <select
                    value={sheetName}
                    onChange={(e) => setSheetName(e.target.value)}
                    className="w-full bg-mist border border-hairline focus:bg-shell focus:bg-mist-2 rounded-xl px-4 py-3 text-ink focus:outline-none transition-all text-sm cursor-pointer"
                  >
                    {availableSheets.map((sheet) => (
                      <option key={sheet} value={sheet}>
                        {sheet}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-quill-soft mt-2">
                    Choose the sheet tab that contains your invoice data.
                  </p>
                </div>
              )}

              {/* Manual Sheet Name (fallback if no sheets fetched) */}
              {availableSheets.length === 0 && spreadsheetId && (
                <div>
                  <label className="block text-xs font-bold text-quill uppercase tracking-wider mb-2">
                    Sheet Name (Tab)
                  </label>
                  <input
                    type="text"
                    value={sheetName}
                    onChange={(e) => setSheetName(e.target.value)}
                    className="w-full bg-mist border border-hairline focus:bg-shell focus:bg-mist-2 rounded-xl px-4 py-3 text-ink placeholder:text-quill-soft focus:outline-none transition-all text-sm"
                    placeholder="e.g. Sheet1, Invoices"
                  />
                </div>
              )}

              {/* Save Button */}
              <div className="flex justify-end pt-4 border-t border-hairline">
                <button
                  onClick={handleSaveSpreadsheet}
                  disabled={saving || !spreadsheetId || !sheetName}
                  className="flex items-center gap-2 bg-brand hover:bg-brand-mid disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl text-sm font-extrabold transition-all shadow-md"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save & Connect'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'template' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-shell rounded-[26px] border border-hairline shadow-sm p-6 lg:p-8 space-y-8">
              {/* Company Info */}
              <div className="space-y-6">
                <h2 className="text-base font-extrabold text-ink flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-brand" /> Company Information
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-quill uppercase tracking-wider mb-2">
                      Company / Business Name
                    </label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full bg-mist border border-hairline focus:bg-shell focus:bg-mist-2 rounded-xl px-4 py-3 text-ink placeholder:text-quill-soft focus:outline-none transition-all text-sm"
                      placeholder="e.g. FAIZ GROUP"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-quill uppercase tracking-wider mb-2">
                      Default Hotel Name
                    </label>
                    <input
                      type="text"
                      value={defaultHotelName}
                      onChange={(e) => setDefaultHotelName(e.target.value)}
                      className="w-full bg-mist border border-hairline focus:bg-shell focus:bg-mist-2 rounded-xl px-4 py-3 text-ink placeholder:text-quill-soft focus:outline-none transition-all text-sm"
                      placeholder="e.g. FAIZ GROUP HOTEL"
                    />
                  </div>
                </div>

                {/* Logo Upload */}
                <div>
                  <label className="block text-xs font-bold text-quill uppercase tracking-wider mb-2">
                    Company Logo
                  </label>
                  <div className="flex items-start gap-4">
                    {companyLogo ? (
                      <div className="relative">
                        <img
                          src={companyLogo}
                          alt="Company Logo"
                          className="w-24 h-24 object-contain border border-hairline rounded-xl bg-shell p-2"
                        />
                        <button
                          onClick={() => setCompanyLogo('')}
                          className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-24 h-24 border-2 border-dashed border-hairline rounded-xl flex items-center justify-center text-quill-soft">
                        <Upload className="w-6 h-6" />
                      </div>
                    )}
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="block w-full text-sm text-quill file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-brand-pale file:text-brand hover:file:bg-blue-100 cursor-pointer"
                      />
                      <p className="text-xs text-quill-soft mt-1">PNG, JPG, or SVG. Max 2MB.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Currency & Tax */}
              <div className="space-y-6 border-t border-hairline pt-6">
                <h2 className="text-base font-extrabold text-ink flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-500" /> Payment & Currency
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-quill uppercase tracking-wider mb-2">
                      Currency
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full bg-mist border border-hairline focus:bg-shell focus:bg-mist-2 rounded-xl px-4 py-3 text-ink focus:outline-none transition-all text-sm"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="PKR">PKR (₨)</option>
                      <option value="AED">AED (د.إ)</option>
                      <option value="SAR">SAR (﷼)</option>
                      <option value="INR">INR (₹)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-quill uppercase tracking-wider mb-2">
                      Timezone
                    </label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full bg-mist border border-hairline focus:bg-shell focus:bg-mist-2 rounded-xl px-4 py-3 text-ink focus:outline-none transition-all text-sm"
                    >
                      <option value="UTC">UTC (Coordinated Universal Time)</option>
                      <option value="Asia/Karachi">Asia/Karachi (PKT, UTC+5)</option>
                      <option value="Asia/Dubai">Asia/Dubai (GST, UTC+4)</option>
                      <option value="Asia/Riyadh">Asia/Riyadh (AST, UTC+3)</option>
                      <option value="Asia/Kolkata">Asia/Kolkata (IST, UTC+5:30)</option>
                      <option value="Europe/London">Europe/London (GMT/BST)</option>
                      <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                      <option value="America/New_York">America/New_York (EST/EDT)</option>
                      <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                      <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                      <option value="Asia/Tokyo">Asia/Tokyo (JST, UTC+9)</option>
                      <option value="Asia/Shanghai">Asia/Shanghai (CST, UTC+8)</option>
                      <option value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-quill uppercase tracking-wider mb-2">
                      Tax Rate (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={taxRate}
                      onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                      className="w-full bg-mist border border-hairline focus:bg-shell focus:bg-mist-2 rounded-xl px-4 py-3 text-ink placeholder:text-quill-soft focus:outline-none transition-all text-sm"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-quill uppercase tracking-wider mb-2">
                    Default Payment Details / Banking Info
                  </label>
                  <textarea
                    value={paymentDetails}
                    onChange={(e) => setPaymentDetails(e.target.value)}
                    rows={4}
                    className="w-full bg-mist border border-hairline focus:bg-shell focus:bg-mist-2 rounded-xl px-4 py-3 text-ink placeholder:text-quill-soft focus:outline-none transition-all text-sm font-mono leading-relaxed"
                    placeholder="Beneficiaire Bank of America&#10;Swift Sort&#10;Account No.: 324 6654 7766 9992"
                  />
                </div>
              </div>

              {/* Terms & Conditions */}
              <div className="space-y-6 border-t border-hairline pt-6">
                <h2 className="text-base font-extrabold text-ink flex items-center gap-2">
                  <FileText className="w-5 h-5 text-violet-500" /> Terms & Conditions
                </h2>

                <div>
                  <label className="block text-xs font-bold text-quill uppercase tracking-wider mb-2">
                    Terms & Conditions (shown on invoice)
                  </label>
                  <textarea
                    value={termsAndConditions}
                    onChange={(e) => setTermsAndConditions(e.target.value)}
                    rows={5}
                    className="w-full bg-mist border border-hairline focus:bg-shell focus:bg-mist-2 rounded-xl px-4 py-3 text-ink placeholder:text-quill-soft focus:outline-none transition-all text-sm leading-relaxed"
                    placeholder="Payment is due within 30 days of invoice date.&#10;Late payments may incur additional charges."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-quill uppercase tracking-wider mb-2">
                    Default Notes (pre-filled on new invoices)
                  </label>
                  <textarea
                    value={defaultNotes}
                    onChange={(e) => setDefaultNotes(e.target.value)}
                    rows={3}
                    className="w-full bg-mist border border-hairline focus:bg-shell focus:bg-mist-2 rounded-xl px-4 py-3 text-ink placeholder:text-quill-soft focus:outline-none transition-all text-sm leading-relaxed"
                    placeholder="Additional notes that appear on every invoice..."
                  />
                </div>
              </div>

              {/* Contact & Footer */}
              <div className="space-y-6 border-t border-hairline pt-6">
                <h2 className="text-base font-extrabold text-ink flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-rose-500" /> Contact & Footer
                </h2>

                <div>
                  <label className="block text-xs font-bold text-quill uppercase tracking-wider mb-2">
                    Tagline
                  </label>
                  <input
                    type="text"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    className="w-full bg-mist border border-hairline focus:bg-shell focus:bg-mist-2 rounded-xl px-4 py-3 text-ink placeholder:text-quill-soft focus:outline-none transition-all text-sm"
                    placeholder="e.g. Smart Finances, Better Business"
                  />
                  <p className="text-xs text-quill-soft mt-1">Shown below the company name on the invoice header.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-quill uppercase tracking-wider mb-2">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="w-full bg-mist border border-hairline focus:bg-shell focus:bg-mist-2 rounded-xl px-4 py-3 text-ink placeholder:text-quill-soft focus:outline-none transition-all text-sm"
                      placeholder="e.g. 123-456-7890"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-quill uppercase tracking-wider mb-2">
                      Email Address
                    </label>
                    <input
                      type="text"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="w-full bg-mist border border-hairline focus:bg-shell focus:bg-mist-2 rounded-xl px-4 py-3 text-ink placeholder:text-quill-soft focus:outline-none transition-all text-sm"
                      placeholder="e.g. billing@company.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-quill uppercase tracking-wider mb-2">
                      Address
                    </label>
                    <input
                      type="text"
                      value={contactAddress}
                      onChange={(e) => setContactAddress(e.target.value)}
                      className="w-full bg-mist border border-hairline focus:bg-shell focus:bg-mist-2 rounded-xl px-4 py-3 text-ink placeholder:text-quill-soft focus:outline-none transition-all text-sm"
                      placeholder="e.g. 123 Anywhere St., Any City"
                    />
                  </div>
                </div>
                <p className="text-xs text-quill-soft">These details appear in the invoice footer (phone, email, address).</p>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-4 border-t border-hairline">
                <button
                  onClick={handleSaveTemplate}
                  disabled={saving}
                  className="flex items-center gap-2 bg-brand hover:bg-brand-mid disabled:bg-blue-400 text-white px-6 py-3 rounded-xl text-sm font-extrabold transition-all shadow-md"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Template Settings'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

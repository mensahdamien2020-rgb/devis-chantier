const DB = (() => {
  const KEY_COMPANY = "devis_company_v1";
  const KEY_DRAFT = "devis_current_draft_v1";
  const KEY_COUNTER = "devis_counter_v1";
  const KEY_ARCHIVE = "devis_archive_v1";

  function getCompany() {
    try { return JSON.parse(localStorage.getItem(KEY_COMPANY)) || {}; }
    catch (e) { return {}; }
  }

  function saveCompany(data) {
    localStorage.setItem(KEY_COMPANY, JSON.stringify(data));
  }

  function getDraft() {
    try { return JSON.parse(localStorage.getItem(KEY_DRAFT)); }
    catch (e) { return null; }
  }

  function saveDraft(data) {
    localStorage.setItem(KEY_DRAFT, JSON.stringify(data));
  }

  function clearDraft() {
    localStorage.removeItem(KEY_DRAFT);
  }

  function nextDevisNumber() {
    const year = new Date().getFullYear();
    let counter = {};
    try { counter = JSON.parse(localStorage.getItem(KEY_COUNTER)) || {}; }
    catch (e) { counter = {}; }
    const current = (counter[year] || 0) + 1;
    counter[year] = current;
    localStorage.setItem(KEY_COUNTER, JSON.stringify(counter));
    return "DEV-" + year + "-" + String(current).padStart(4, "0");
  }

  function peekDevisNumber() {
    const year = new Date().getFullYear();
    let counter = {};
    try { counter = JSON.parse(localStorage.getItem(KEY_COUNTER)) || {}; }
    catch (e) { counter = {}; }
    const current = (counter[year] || 0) + 1;
    return "DEV-" + year + "-" + String(current).padStart(4, "0");
  }

  function archiveDevis(devis) {
    let list = [];
    try { list = JSON.parse(localStorage.getItem(KEY_ARCHIVE)) || []; }
    catch (e) { list = []; }
    list.unshift(devis);
    if (list.length > 100) list = list.slice(0, 100);
    localStorage.setItem(KEY_ARCHIVE, JSON.stringify(list));
  }

  function getArchive() {
    try { return JSON.parse(localStorage.getItem(KEY_ARCHIVE)) || []; }
    catch (e) { return []; }
  }

  return {
    getCompany: getCompany,
    saveCompany: saveCompany,
    getDraft: getDraft,
    saveDraft: saveDraft,
    clearDraft: clearDraft,
    nextDevisNumber: nextDevisNumber,
    peekDevisNumber: peekDevisNumber,
    archiveDevis: archiveDevis,
    getArchive: getArchive
  };
})();

/**
 * github-repos-card
 * Lovelace card for Home Assistant to display GitHub repositories
 * from the GitHub integration in a sortable, groupable table.
 *
 * @author Noack1978
 * @license MIT
 * @version 1.0.0
 * @url https://github.com/Noack1978/github-repos-card
 */

const VERSION = '1.4.0';

// Known suffixes for "stars" entity in different HA languages
const STAR_SUFFIXES = ['_sterne', '_stars', '_étoiles', '_sterren', '_estrelas', '_estrellas'];

// Column definitions
const COLUMNS = [
  { id: 'repo',   label: 'Repository', numeric: false },
  { id: 'user',   label: 'Benutzer',   numeric: false },
  { id: 'ver',    label: 'Version',    numeric: false },
  { id: 'iss',    label: 'Probleme',   numeric: true  },
  { id: 'stars',  label: '⭐',         numeric: true  },
  { id: 'forks',  label: '🍴',         numeric: true  },
];

// Suffix map: base suffix → sensor suffixes for other columns
const SUFFIX_MAP = {
  _sterne:    { ver: '_neueste_version', iss: '_probleme', forks: '_forks' },
  _stars:     { ver: '_latest_release',  iss: '_issues',   forks: '_forks' },
  _étoiles:   { ver: '_latest_release',  iss: '_issues',   forks: '_forks' },
  _sterren:   { ver: '_latest_release',  iss: '_issues',   forks: '_forks' },
  _estrelas:  { ver: '_latest_release',  iss: '_issues',   forks: '_forks' },
  _estrellas: { ver: '_latest_release',  iss: '_issues',   forks: '_forks' },
};

const INVALID = v => !v || ['unavailable', 'unknown', 'none', 'null'].includes(String(v).toLowerCase());

class GithubReposCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._sortCol  = 'repo';
    this._sortAsc  = true;
    this._groupCol = null;
    this._starSuffix = null;
    this._suffixMap  = null;
  }

  static getConfigElement() {
    return document.createElement('github-repos-card-editor');
  }

  static getStubConfig() {
    return {};
  }

  setConfig(config) {
    this._config = config || {};
    // Allow manual override via card config
    if (config.star_suffix) {
      this._starSuffix = config.star_suffix;
      this._suffixMap  = SUFFIX_MAP[config.star_suffix] || SUFFIX_MAP['_stars'];
    }
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() { return 5; }

  // ── Entity discovery ───────────────────────────────────────────────────────

  _detectSuffix(states) {
    if (this._starSuffix) return;
    for (const suffix of STAR_SUFFIXES) {
      const found = Object.keys(states).find(
        id => id.startsWith('sensor.') && id.endsWith(suffix)
      );
      if (found) {
        this._starSuffix = suffix;
        this._suffixMap  = SUFFIX_MAP[suffix] || SUFFIX_MAP['_stars'];
        return;
      }
    }
  }

  _findStarEntityIds() {
    const entities = this._hass.entities || {};
    const states   = this._hass.states   || {};

    this._detectSuffix(states);
    if (!this._starSuffix) return [];

    // Primary: use entity registry (has platform info → most accurate)
    const fromRegistry = Object.values(entities)
      .filter(e => e.platform === 'github' && e.entity_id.endsWith(this._starSuffix))
      .map(e => e.entity_id);

    if (fromRegistry.length > 0) return fromRegistry;

    // Fallback: scan all states
    return Object.keys(states).filter(
      id => id.startsWith('sensor.') && id.endsWith(this._starSuffix)
    );
  }

  _buildRepo(starId) {
    const states = this._hass.states || {};
    const sm     = this._suffixMap;
    const b      = starId.replace('sensor.', '').replace(this._starSuffix, '');

    const verState   = states[`sensor.${b}${sm.ver}`];
    const issState   = states[`sensor.${b}${sm.iss}`];
    const forksState = states[`sensor.${b}${sm.forks}`];
    const starsState = states[starId];

    // Try multiple sensors to extract the repo URL
    const releaseUrl = verState?.attributes?.url || '';
    let repoUrl = releaseUrl ? releaseUrl.split('/releases/')[0] : '';

    if (!repoUrl) {
      // Fallback: latest issue URL → https://github.com/user/repo/issues/N
      const issSuffix = sm.iss === '_probleme' ? '_letztes_problem' : '_latest_issue';
      const issUrl = states[`sensor.${b}${issSuffix}`]?.attributes?.url || '';
      if (issUrl) repoUrl = issUrl.split('/issues/')[0];
    }

    if (!repoUrl) {
      // Fallback: latest commit URL → https://github.com/user/repo/commit/sha
      const commitSuffix = sm.iss === '_probleme' ? '_letzter_commit' : '_latest_commit';
      const commitUrl = states[`sensor.${b}${commitSuffix}`]?.attributes?.url || '';
      if (commitUrl) repoUrl = commitUrl.split('/commit/')[0];
    }

    if (!repoUrl) {
      // Fallback: latest discussion URL → https://github.com/user/repo/discussions/N
      const discSuffix = sm.iss === '_probleme' ? '_letzte_diskussion' : '_latest_discussion';
      const discUrl = states[`sensor.${b}${discSuffix}`]?.attributes?.url || '';
      if (discUrl) repoUrl = discUrl.split('/discussions/')[0];
    }

    const repoName   = repoUrl
      ? repoUrl.split('/').pop().replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      : b.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const userName   = repoUrl ? (repoUrl.split('/').slice(-2, -1)[0] || '') : '';

    const ver   = verState?.attributes?.tag || verState?.state;
    const iss   = issState?.state;
    const forks = forksState?.state;
    const stars = starsState?.state;

    return {
      repoName,
      userName,
      ver:      INVALID(ver)   ? '—' : ver,
      iss:      INVALID(iss)   ? '—' : iss,
      stars:    INVALID(stars) ? '—' : stars,
      forks:    INVALID(forks) ? '—' : forks,
      repoUrl,
      issNum:   parseInt(iss)   || 0,
      starsNum: parseInt(stars) || 0,
      forksNum: parseInt(forks) || 0,
    };
  }

  _getRepos() {
    const all = this._findStarEntityIds().map(id => this._buildRepo(id));
    const filter = this._config.repos;
    if (!filter || filter.length === 0) return all;
    return all.filter(r => {
      const base = r.repoUrl
        ? r.repoUrl.split('/').pop().toLowerCase().replace(/[-]/g, '_')
        : r.repoName.toLowerCase().replace(/\s/g, '_');
      return filter.some(f => base.includes(f) || f.includes(base));
    });
  }

  // ── Sorting ────────────────────────────────────────────────────────────────

  _sortRepos(repos) {
    return [...repos].sort((a, b) => {
      let va, vb;
      switch (this._sortCol) {
        case 'repo':  va = a.repoName.toLowerCase(); vb = b.repoName.toLowerCase(); break;
        case 'user':  va = a.userName.toLowerCase(); vb = b.userName.toLowerCase(); break;
        case 'ver':   va = a.ver.toLowerCase();       vb = b.ver.toLowerCase();      break;
        case 'iss':   va = a.issNum;   vb = b.issNum;   break;
        case 'stars': va = a.starsNum; vb = b.starsNum; break;
        case 'forks': va = a.forksNum; vb = b.forksNum; break;
        default:      va = a.repoName.toLowerCase(); vb = b.repoName.toLowerCase();
      }
      if (va < vb) return this._sortAsc ? -1 : 1;
      if (va > vb) return this._sortAsc ?  1 : -1;
      return 0;
    });
  }

  _handleSort(col) {
    if (this._sortCol === col) {
      this._sortAsc = !this._sortAsc;
    } else {
      this._sortCol = col;
      this._sortAsc = true;
    }
    this._render();
  }

  // ── Grouping ───────────────────────────────────────────────────────────────

  _handleGroup(col) {
    this._groupCol = this._groupCol === col ? null : col;
    this._render();
  }

  _groupValue(repo, col) {
    switch (col) {
      case 'repo':  return repo.repoName[0]?.toUpperCase() || '?';
      case 'user':  return repo.userName || '—';
      case 'ver': {
        if (repo.ver === '—') return '—';
        const m = repo.ver.match(/^v?(\d+)/);
        return m ? `v${m[1]}.x` : repo.ver;
      }
      case 'iss': {
        const n = repo.issNum;
        if (n === 0)  return '0 Probleme';
        if (n <= 5)   return '1–5';
        if (n <= 20)  return '6–20';
        return '21+';
      }
      case 'stars': {
        const n = repo.starsNum;
        if (n === 0)     return '0';
        if (n < 10)      return '< 10';
        if (n < 100)     return '10–99';
        if (n < 1000)    return '100–999';
        return '1000+';
      }
      case 'forks': {
        const n = repo.forksNum;
        if (n === 0)  return '0';
        if (n < 10)   return '< 10';
        if (n < 50)   return '10–49';
        return '50+';
      }
      default: return '?';
    }
  }

  _sortGroupKeys(keys, col) {
    const numOrder = {
      '0 Probleme': 0, '1–5': 1, '6–20': 2, '21+': 3,
      '0': 0, '< 10': 1, '10–49': 2, '10–99': 1, '100–999': 2, '50+': 3, '1000+': 4,
    };
    return [...keys].sort((a, b) => {
      const ai = numOrder[a]; const bi = numOrder[b];
      if (ai !== undefined && bi !== undefined) return ai - bi;
      return a.localeCompare(b);
    });
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  _arrow(col) {
    if (this._sortCol !== col) return '<span class="si dim">↕</span>';
    return `<span class="si">${this._sortAsc ? '↑' : '↓'}</span>`;
  }

  _row(repo) {
    const link = repo.repoUrl
      ? `<a href="${repo.repoUrl}" target="_blank" rel="noopener">${repo.repoName}</a>`
      : repo.repoName;
    return `
      <tr>
        <td>${link}</td>
        <td>${repo.userName}</td>
        <td>${repo.ver}</td>
        <td class="n">${repo.iss}</td>
        <td class="n">${repo.stars}</td>
        <td class="n">${repo.forks}</td>
      </tr>`;
  }

  _buildRows(sorted) {
    if (!this._groupCol) return sorted.map(r => this._row(r)).join('');

    // Build groups
    const groups = {};
    sorted.forEach(repo => {
      const gv = this._groupValue(repo, this._groupCol);
      if (!groups[gv]) groups[gv] = [];
      groups[gv].push(repo);
    });

    const colLabel = COLUMNS.find(c => c.id === this._groupCol)?.label || this._groupCol;
    const keys = this._sortGroupKeys(Object.keys(groups), this._groupCol);

    return keys.map(key => `
      <tr class="gh">
        <td colspan="6">
          <span class="gl">${colLabel}: ${key}</span>
          <span class="gc">${groups[key].length} Repos</span>
        </td>
      </tr>
      ${groups[key].map(r => this._row(r)).join('')}
    `).join('');
  }

  _render() {
    if (!this._hass) return;

    const repos  = this._getRepos();
    const sorted = this._sortRepos(repos);

    const chips = COLUMNS.map(col => `
      <button class="chip${this._groupCol === col.id ? ' on' : ''}" data-g="${col.id}">
        ${col.label}
      </button>`).join('');

    const headers = COLUMNS.map(col => `
      <th class="${this._sortCol === col.id ? 'ac' : ''}${col.numeric ? ' n' : ''}" data-s="${col.id}">
        ${col.label}${this._arrow(col.id)}
      </th>`).join('');

    const body = repos.length === 0
      ? `<tr><td colspan="6" class="empty">
           Keine GitHub-Repositories gefunden.<br>
           <small>GitHub-Integration konfigurieren oder <code>star_suffix</code> im Karten-YAML setzen.</small>
         </td></tr>`
      : this._buildRows(sorted);

    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; }
        .card {
          background: var(--card-background-color, #1e1e2e);
          border-radius: var(--ha-card-border-radius, 12px);
          padding: 16px;
          box-shadow: var(--ha-card-box-shadow, 0 2px 8px rgba(0,0,0,.3));
          font-family: var(--paper-font-body1_-_font-family, 'Roboto', sans-serif);
        }
        /* Header */
        .hdr {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 14px;
        }
        .hdr-icon { font-size: 1.4em; }
        .hdr-title {
          font-size: 1.05em;
          font-weight: 600;
          color: var(--primary-text-color);
          flex: 1;
        }
        .badge {
          font-size: 0.75em;
          padding: 2px 9px;
          border-radius: 10px;
          background: var(--secondary-background-color, rgba(255,255,255,.08));
          color: var(--secondary-text-color);
        }
        /* Group bar */
        .gbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 4px;
          row-gap: 4px;
          margin-bottom: 12px;
        }
        .glbl {
          font-size: 0.72em;
          color: var(--secondary-text-color);
          white-space: nowrap;
          margin-right: 2px;
        }
        .chip {
          font-size: 0.70em;
          padding: 2px 9px;
          border-radius: 12px;
          border: 1px solid var(--divider-color, #444);
          background: transparent;
          color: var(--primary-text-color);
          cursor: pointer;
          transition: background .15s, border-color .15s, color .15s;
          line-height: 1.6;
          white-space: nowrap;
        }
        .chip:hover { border-color: var(--primary-color, #03a9f4); }
        .chip.on {
          background: var(--primary-color, #03a9f4);
          border-color: var(--primary-color, #03a9f4);
          color: #fff;
        }
        /* Table */
        .table-wrap {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.88em;
        }
        th {
          padding: 8px 6px;
          border-bottom: 2px solid var(--divider-color, #333);
          color: var(--secondary-text-color);
          font-weight: 600;
          cursor: pointer;
          user-select: none;
          white-space: nowrap;
          transition: color .15s;
          text-align: left;
        }
        th:hover, th.ac { color: var(--primary-color, #03a9f4); }
        th.n, td.n { text-align: right; }
        td {
          padding: 7px 6px;
          border-bottom: 1px solid var(--divider-color, rgba(255,255,255,.06));
          color: var(--primary-text-color);
          vertical-align: middle;
        }
        tr:last-child td { border-bottom: none; }
        tbody tr:hover td {
          background: var(--secondary-background-color, rgba(255,255,255,.04));
        }
        a {
          color: var(--primary-color, #03a9f4);
          text-decoration: none;
        }
        a:hover { text-decoration: underline; }
        /* Sort icons */
        .si { margin-left: 3px; font-size: .8em; }
        .si.dim { opacity: .25; }
        /* Group header row */
        tr.gh td {
          background: var(--secondary-background-color, rgba(255,255,255,.06));
          padding: 5px 8px;
          font-size: 0.78em;
          border-bottom: 1px solid var(--divider-color, #333);
          border-top: 1px solid var(--divider-color, #333);
        }
        .gl {
          font-weight: 600;
          color: var(--primary-color, #03a9f4);
          margin-right: 6px;
        }
        .gc { color: var(--secondary-text-color); }
        /* Empty state */
        .empty {
          text-align: center;
          padding: 28px 12px;
          color: var(--secondary-text-color);
          line-height: 1.8;
        }
        .empty small { opacity: .7; }
        code {
          background: rgba(255,255,255,.08);
          padding: 1px 5px;
          border-radius: 4px;
          font-size: .9em;
        }
      </style>

      <div class="card">
        <div class="hdr">
          <span class="hdr-icon">🐙</span>
          <span class="hdr-title">GitHub Repositories</span>
          <span class="badge">${repos.length}</span>
        </div>

        <div class="gbar">
          <span class="glbl">Gruppieren:</span>
          ${chips}
        </div>

        <div class="table-wrap">
          <table>
            <thead><tr>${headers}</tr></thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      </div>
    `;

    // Attach events
    this.shadowRoot.querySelectorAll('th[data-s]').forEach(th =>
      th.addEventListener('click', () => this._handleSort(th.dataset.s))
    );
    this.shadowRoot.querySelectorAll('button[data-g]').forEach(btn =>
      btn.addEventListener('click', () => this._handleGroup(btn.dataset.g))
    );
  }
}

// ── Visual Editor ──────────────────────────────────────────────────────────────

class GithubReposCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass   = null;
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  setConfig(config) {
    this._config = config || {};
    this._render();
  }

  // Detect star suffix and return list of { base, repoName, userName }
  _detectRepos() {
    if (!this._hass) return { suffix: null, repos: [] };
    const states = this._hass.states || {};

    let suffix = this._config.star_suffix || null;
    if (!suffix) {
      for (const s of STAR_SUFFIXES) {
        if (Object.keys(states).some(id => id.startsWith('sensor.') && id.endsWith(s))) {
          suffix = s;
          break;
        }
      }
    }
    if (!suffix) return { suffix: null, repos: [] };

    const sm = SUFFIX_MAP[suffix] || SUFFIX_MAP['_stars'];
    const repos = Object.keys(states)
      .filter(id => id.startsWith('sensor.') && id.endsWith(suffix))
      .map(starId => {
        const b = starId.replace('sensor.', '').replace(suffix, '');
        const verState = states[`sensor.${b}${sm.ver}`];
        const releaseUrl = verState?.attributes?.url || '';
        let repoUrl = releaseUrl ? releaseUrl.split('/releases/')[0] : '';

        if (!repoUrl) {
          const issSuffix = sm.iss === '_probleme' ? '_letztes_problem' : '_latest_issue';
          const issUrl = states[`sensor.${b}${issSuffix}`]?.attributes?.url || '';
          if (issUrl) repoUrl = issUrl.split('/issues/')[0];
        }
        if (!repoUrl) {
          const commitSuffix = sm.iss === '_probleme' ? '_letzter_commit' : '_latest_commit';
          const commitUrl = states[`sensor.${b}${commitSuffix}`]?.attributes?.url || '';
          if (commitUrl) repoUrl = commitUrl.split('/commit/')[0];
        }

        const repoName = repoUrl
          ? repoUrl.split('/').pop().replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
          : b.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const userName = repoUrl ? (repoUrl.split('/').slice(-2, -1)[0] || '') : '';

        return { base: b, repoName, userName };
      })
      .sort((a, b) => a.repoName.localeCompare(b.repoName));

    return { suffix, repos };
  }

  _fireConfig(newConfig) {
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: newConfig },
      bubbles: true,
      composed: true,
    }));
  }

  _render() {
    const { suffix, repos } = this._detectRepos();
    const selectedSuffix    = this._config.star_suffix || '';
    const selectedRepos     = this._config.repos || [];   // [] = show all
    const showAll           = selectedRepos.length === 0;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; font-family: var(--paper-font-body1_-_font-family, sans-serif); }
        .editor { padding: 4px 0; display: flex; flex-direction: column; gap: 20px; }

        /* Info box */
        .info {
          display: flex; align-items: flex-start; gap: 10px; padding: 12px;
          background: var(--secondary-background-color, rgba(255,255,255,.06));
          border-radius: 8px; font-size: 0.88em;
          color: var(--secondary-text-color); line-height: 1.5;
        }
        .info-icon { font-size: 1.4em; flex-shrink: 0; }

        /* Section */
        .section-title {
          font-size: 0.78em; font-weight: 600; text-transform: uppercase;
          letter-spacing: .06em; color: var(--secondary-text-color);
          margin-bottom: 8px;
        }

        /* Repo list */
        .repo-list { display: flex; flex-direction: column; gap: 2px; }
        .repo-row {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 10px; border-radius: 6px; cursor: pointer;
          transition: background .12s;
        }
        .repo-row:hover { background: var(--secondary-background-color, rgba(255,255,255,.06)); }
        .repo-row input[type=checkbox] { accent-color: var(--primary-color, #03a9f4); width: 16px; height: 16px; cursor: pointer; }
        .repo-label { display: flex; flex-direction: column; flex: 1; }
        .repo-name { font-size: 0.9em; color: var(--primary-text-color); }
        .repo-user { font-size: 0.75em; color: var(--secondary-text-color); }

        /* All toggle */
        .all-row {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 10px; border-radius: 6px; cursor: pointer;
          border-bottom: 1px solid var(--divider-color, #333);
          margin-bottom: 4px;
        }
        .all-row:hover { background: var(--secondary-background-color, rgba(255,255,255,.06)); }
        .all-label { font-size: 0.9em; font-weight: 600; color: var(--primary-text-color); }
        .all-count { font-size: 0.75em; color: var(--secondary-text-color); }

        /* Suffix field */
        .field { display: flex; flex-direction: column; gap: 6px; }
        label { font-size: 0.82em; font-weight: 500; color: var(--secondary-text-color); }
        input[type=text] {
          background: var(--secondary-background-color, rgba(255,255,255,.06));
          border: 1px solid var(--divider-color, #444); border-radius: 6px;
          padding: 9px 12px; color: var(--primary-text-color); font-size: 0.92em;
          outline: none; transition: border-color .15s; font-family: monospace; width: 100%; box-sizing: border-box;
        }
        input[type=text]:focus { border-color: var(--primary-color, #03a9f4); }
        input[type=text]::placeholder { color: var(--disabled-text-color, #666); }
        .hint { font-size: 0.76em; color: var(--secondary-text-color); opacity: 0.8; }
        .tags { display: flex; flex-wrap: wrap; gap: 4px; }
        .tag {
          font-size: 0.72em; padding: 2px 8px; border-radius: 10px;
          background: var(--secondary-background-color, rgba(255,255,255,.08));
          color: var(--secondary-text-color); font-family: monospace; cursor: pointer;
          border: 1px solid var(--divider-color, #444); transition: border-color .15s;
        }
        .tag:hover { border-color: var(--primary-color, #03a9f4); }
        .detected {
          font-size: 0.76em; color: var(--primary-color, #03a9f4);
          display: flex; align-items: center; gap: 4px;
        }
      </style>

      <div class="editor">
        <div class="info">
          <span class="info-icon">🐙</span>
          <span>Zeigt Repositories aus der GitHub-Integration in einer sortierbaren und gruppierbaren Tabelle.
          Standardmäßig werden alle Repositories angezeigt.</span>
        </div>

        <div>
          <div class="section-title">Repositories</div>
          ${repos.length === 0 ? `
            <div class="hint">Keine GitHub-Repositories gefunden. GitHub-Integration prüfen.</div>
          ` : `
            <div class="repo-list">
              <div class="all-row" data-action="toggle-all">
                <input type="checkbox" id="cb-all" ${showAll ? 'checked' : ''} />
                <span class="all-label">Alle anzeigen</span>
                <span class="all-count">${repos.length} Repos</span>
              </div>
              ${repos.map(r => `
                <div class="repo-row" data-action="toggle-repo" data-base="${r.base}">
                  <input type="checkbox" ${showAll || selectedRepos.includes(r.base) ? 'checked' : ''} data-base="${r.base}" />
                  <div class="repo-label">
                    <span class="repo-name">${r.repoName}</span>
                    <span class="repo-user">${r.userName}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <div class="field">
          <label>Sterne-Suffix (optional)</label>
          ${suffix ? `<div class="detected">✓ Automatisch erkannt: <code>${suffix}</code></div>` : ''}
          <input type="text" placeholder="Automatisch erkannt" value="${selectedSuffix}" id="suffix-input" />
          <span class="hint">Nur setzen falls die automatische Erkennung fehlschlägt:</span>
          <div class="tags">
            ${STAR_SUFFIXES.map(s => `<span class="tag" data-suffix="${s}">${s}</span>`).join('')}
          </div>
        </div>
      </div>
    `;

    // "Alle" checkbox
    const cbAll = this.shadowRoot.querySelector('#cb-all');
    if (cbAll) {
      this.shadowRoot.querySelector('[data-action="toggle-all"]').addEventListener('click', e => {
        if (e.target.tagName === 'INPUT') return;
        cbAll.click();
      });
      cbAll.addEventListener('change', () => {
        const newConfig = { ...this._config };
        delete newConfig.repos;
        this._fireConfig(newConfig);
      });
    }

    // Individual repo checkboxes
    this.shadowRoot.querySelectorAll('[data-action="toggle-repo"]').forEach(row => {
      const base = row.dataset.base;
      const cb   = row.querySelector('input[type=checkbox]');
      row.addEventListener('click', e => { if (e.target.tagName === 'INPUT') return; cb.click(); });
      cb.addEventListener('change', () => {
        let current = [...(this._config.repos || repos.map(r => r.base))];
        if (cb.checked) {
          if (!current.includes(base)) current.push(base);
        } else {
          current = current.filter(b => b !== base);
        }
        // If all selected → same as "Alle"
        const newConfig = { ...this._config };
        if (current.length === repos.length) {
          delete newConfig.repos;
        } else {
          newConfig.repos = current;
        }
        this._fireConfig(newConfig);
      });
    });

    // Suffix input
    const suffixInput = this.shadowRoot.querySelector('#suffix-input');
    if (suffixInput) {
      suffixInput.addEventListener('change', () => {
        const val = suffixInput.value.trim();
        const newConfig = { ...this._config };
        if (val) newConfig.star_suffix = val; else delete newConfig.star_suffix;
        this._fireConfig(newConfig);
      });
    }

    // Suffix tags
    this.shadowRoot.querySelectorAll('.tag').forEach(tag => {
      tag.addEventListener('click', () => {
        suffixInput.value = tag.dataset.suffix;
        suffixInput.dispatchEvent(new Event('change'));
      });
    });
  }
}

customElements.define('github-repos-card-editor', GithubReposCardEditor);


customElements.define('github-repos-card', GithubReposCard);

// Register with HA card picker
window.customCards = window.customCards || [];
window.customCards.push({
  type:             'github-repos-card',
  name:             'GitHub Repos Card',
  description:      'Sortierbare und gruppierbare Tabelle aller GitHub-Repositories aus der GitHub-Integration.',
  preview:          false,
  documentationURL: 'https://github.com/Noack1978/github-repos-card',
});

console.info(
  '%c GITHUB-REPOS-CARD %c v' + VERSION + ' ',
  'color:#fff;background:#24292e;font-weight:bold;padding:2px 4px;border-radius:3px 0 0 3px;',
  'color:#24292e;background:#f6f8fa;font-weight:bold;padding:2px 4px;border-radius:0 3px 3px 0;'
);

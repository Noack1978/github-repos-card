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

const VERSION = '1.0.0';

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

    const releaseUrl = verState?.attributes?.url || '';
    const repoUrl    = releaseUrl ? releaseUrl.split('/releases/')[0] : '';
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
    return this._findStarEntityIds().map(id => this._buildRepo(id));
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

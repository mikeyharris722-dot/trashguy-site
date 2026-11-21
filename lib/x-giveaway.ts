export type XEntry = {
    username: string;
    accountId?: string;
};
export type XDraw = {
    winner: XEntry;
    index: number;
    createdAt: string;
};
export type XSnapshot = {
    id: string;
    requestId: string;
    fingerprint: string;
    postUrl: string;
    author: string;
    excluded: string[];
    entries: XEntry[];
    createdAt: string;
    createdBy: string;
    draw?: XDraw;
    collectionId?: string;
    collectionWarning?: string;
};
export type XState = {
    snapshots: XSnapshot[];
    collections?: import("./x-collection").XCollection[];
};
export function username(value: string): string {
    const raw = value.trim().replace(/^'/, '');
    const match = raw.match(/^https:\/\/(?:www\.)?(?:x|twitter)\.com\/([a-z0-9_]{1,15})\/?$/i);
    const name = (match?.[1] || raw.replace(/^@/, ''));
    if (!/^[a-z0-9_]{1,15}$/i.test(name))
        throw Error(`Invalid X username: ${raw.slice(0, 50)}`);
    return name;
}
export function postInfo(value: string) {
    if (!value.trim())
        return { postUrl: '', author: '' };
    const url = new URL(value);
    const match = url.pathname.match(/^\/([a-z0-9_]{1,15})\/status\/(\d+)\/?$/i);
    if (url.protocol !== 'https:' || !['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(url.hostname) || url.username || url.password || url.port || !match)
        throw Error('Enter a public https://x.com/username/status/123 post URL.');
    return { postUrl: `https://x.com/${match[1]}/status/${match[2]}`, author: match[1] };
}
// RFC-style quoted CSV, including embedded commas/newlines and escaped quotes.
export function csvRows(text: string): string[][] {
    if (text.length > 2000000)
        throw Error('CSV is too large (maximum 2 MB).');
    const rows: string[][] = [];
    let row: string[] = [], cell = '', quoted = false;
    text = text.replace(/^\uFEFF/, '');
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '"') {
            if (quoted && text[i + 1] === '"') {
                cell += '"';
                i++;
            }
            else if (quoted || !cell)
                quoted = !quoted;
            else
                throw Error('Malformed CSV quote.');
        }
        else if (c === ',' && !quoted) {
            row.push(cell);
            cell = '';
        }
        else if ((c === '\n' || c === '\r') && !quoted) {
            if (c === '\r' && text[i + 1] === '\n')
                i++;
            row.push(cell);
            if (row.some(x => x.trim()))
                rows.push(row);
            row = [];
            cell = '';
        }
        else
            cell += c;
    }
    if (quoted)
        throw Error('CSV contains an unfinished quoted field.');
    row.push(cell);
    if (row.some(x => x.trim()))
        rows.push(row);
    return rows;
}
export function importEntries(text: string, manual = false): XEntry[] {
    const rows = manual ? text.split(/[\n,;]+/).filter(x => x.trim()).map(x => [x.trim()]) : csvRows(text);
    if (!rows.length)
        return [];
    const headers = rows[0].map(x => x.trim().toLowerCase().replace(/[ _-]/g, ''));
    const column = headers.findIndex(x => ['username', 'xusername', 'twitterusername', 'handle', 'author', 'screenname'].includes(x));
    const idColumn = headers.findIndex(x => ['userid', 'accountid', 'authorid', 'xuserid', 'twitteruserid'].includes(x));
    if (column < 0 && rows.some(r => r.length > 1))
        throw Error('CSV needs a Username, Handle or Author column.');
    return (column >= 0 ? rows.slice(1) : rows).map((r, i) => {
        try {
            const accountId = idColumn >= 0 ? (r[idColumn] || '').trim() : '';
            if (accountId && !/^\d{1,25}$/.test(accountId))
                throw Error('Account IDs must be exact digits, not spreadsheet scientific notation.');
            return { username: username(r[column >= 0 ? column : 0] || ''), ...(accountId ? { accountId } : {}) };
        }
        catch (e) {
            throw Error(`Row ${i + (column >= 0 ? 2 : 1)}: ${(e as Error).message}`);
        }
    });
}
export function eligibleEntries(input: XEntry[], author: string, excluded: string[]) {
    if (input.length > 10000)
        throw Error('Maximum 10,000 imported rows.');
    const blocked = new Set(['trashguy__', author, ...excluded].filter(Boolean).map(x => username(x).toLowerCase()));
    const entries: XEntry[] = [];
    const roots = new Map<string, string>();
    function root(key: string): string { if (!roots.has(key))
        roots.set(key, key); let top = key; while (roots.get(top) !== top)
        top = roots.get(top)!; while (key !== top) {
        const next = roots.get(key)!;
        roots.set(key, top);
        key = next;
    } return top; }
    // Account IDs remain strings: converting a snowflake to Number loses precision.
    const validated = input.map(e => ({ username: username(String(e.username || '')), accountId: e.accountId ? String(e.accountId) : undefined }));
    for (const e of validated) {
        if (e.accountId && !/^\d{1,25}$/.test(e.accountId))
            throw Error('Invalid account ID.');
        const name = 'name:' + e.username.toLowerCase();
        root(name);
        if (e.accountId)
            roots.set(root('id:' + e.accountId), root(name));
    }
    const blockedRoots = new Set(validated.filter(e => blocked.has(e.username.toLowerCase())).map(e => root('name:' + e.username.toLowerCase())));
    const seen = new Set<string>();
    let duplicates = 0, exclusions = 0;
    for (const e of validated) {
        const key = root('name:' + e.username.toLowerCase());
        if (blockedRoots.has(key)) {
            exclusions++;
            continue;
        }
        if (seen.has(key)) {
            duplicates++;
            continue;
        }
        seen.add(key);
        const withId = e.accountId ? e : validated.find(v => v.accountId && root('name:' + v.username.toLowerCase()) === key) || e;
        entries.push({ ...e, ...(withId.accountId ? { accountId: withId.accountId } : {}) });
    }
    if (entries.length > 200)
        throw Error(`${entries.length} eligible accounts exceed the 200-participant limit. No entries were loaded or truncated.`);
    return { entries, duplicates, exclusions, raw: input.length };
}

// Imported replies belong to one post; a different post starts with an empty pool.
export function entriesForPost(entries: XEntry[], savedUrl: string, nextUrl: string): XEntry[] {
    return postInfo(savedUrl).postUrl === postInfo(nextUrl).postUrl ? entries : [];
}

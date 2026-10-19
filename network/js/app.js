const $ = (id) => document.getElementById(id);

const statusBox = $("statusBox");
const modeTabs = [...document.querySelectorAll(".mode-tab")];
const panels = [...document.querySelectorAll("[data-panel]")];

function setStatus(message, state = "neutral") {
    statusBox.textContent = message;
    statusBox.className = `status-box is-${state}`;
}

function showMode(mode) {
    modeTabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.mode === mode));
    panels.forEach((panel) => panel.classList.toggle("hidden", panel.dataset.panel !== mode));
    setStatus("Ready.");
}

modeTabs.forEach((tab) => tab.addEventListener("click", () => showMode(tab.dataset.mode)));

function parseIPv4(value) {
    const raw = String(value).trim();
    const parts = raw.split(".");
    if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) throw new Error("Enter a valid IPv4 address.");
    const octets = parts.map(Number);
    if (octets.some((part) => part < 0 || part > 255)) throw new Error("IPv4 octets must be between 0 and 255.");
    const int = (((octets[0] * 256 + octets[1]) * 256 + octets[2]) * 256 + octets[3]);
    return { raw: octets.join("."), octets, int };
}

function intToIPv4(value) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 4294967295) throw new Error("IPv4 integer must be between 0 and 4294967295.");
    const a = Math.floor(n / 16777216);
    const remA = n - a * 16777216;
    const b = Math.floor(remA / 65536);
    const remB = remA - b * 65536;
    const c = Math.floor(remB / 256);
    const d = remB - c * 256;
    return `${a}.${b}.${c}.${d}`;
}

function prefixMask(prefix) {
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) throw new Error("CIDR prefix must be between 0 and 32.");
    if (prefix === 0) return 0;
    return (0xffffffff << (32 - prefix)) >>> 0;
}

function ipv4Class(octets) {
    const [a, b] = octets;
    if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return "Private (RFC1918)";
    if (a === 127) return "Loopback";
    if (a === 169 && b === 254) return "Link-local";
    if (a >= 224 && a <= 239) return "Multicast";
    if (a >= 240) return "Reserved / experimental";
    if (a === 0) return "Current network / special-use";
    return "Public / globally routable candidate";
}

function classLetter(firstOctet) {
    if (firstOctet <= 127) return "Class A (legacy)";
    if (firstOctet <= 191) return "Class B (legacy)";
    if (firstOctet <= 223) return "Class C (legacy)";
    if (firstOctet <= 239) return "Class D (multicast)";
    return "Class E (reserved)";
}

function formatNumber(value) {
    return new Intl.NumberFormat("en-US").format(value);
}

function makeResultCard(label, value) {
    const card = document.createElement("div");
    card.className = "result-card";
    const labelEl = document.createElement("span");
    labelEl.textContent = label;
    const valueEl = document.createElement("strong");
    valueEl.textContent = value;
    card.append(labelEl, valueEl);
    return card;
}

function renderResults(container, items) {
    container.replaceChildren(...items.map(([label, value]) => makeResultCard(label, value)));
}

function subnetData(ipValue, prefixValue) {
    const ip = parseIPv4(ipValue);
    const prefix = Number(prefixValue);
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) throw new Error("CIDR prefix must be between 0 and 32.");
    const mask = prefixMask(prefix);
    const network = (ip.int & mask) >>> 0;
    const wildcard = (~mask) >>> 0;
    const broadcast = (network | wildcard) >>> 0;
    const total = 2 ** (32 - prefix);
    const usable = prefix <= 30 ? Math.max(0, total - 2) : total;
    const firstHost = prefix <= 30 ? network + 1 : network;
    const lastHost = prefix <= 30 ? broadcast - 1 : broadcast;
    return { ip, prefix, mask, network, wildcard, broadcast, total, usable, firstHost, lastHost };
}

function calculateSubnet() {
    try {
        const prefixInput = $("subnetCidr").value.trim();
        if (!/^\d{1,2}$/.test(prefixInput)) throw new Error("Enter a CIDR prefix from 0 to 32.");
        const data = subnetData($("subnetIp").value, Number(prefixInput));
        renderResults($("subnetResults"), [
            ["Network", `${intToIPv4(data.network)}/${data.prefix}`],
            ["Subnet mask", intToIPv4(data.mask)],
            ["Wildcard mask", intToIPv4(data.wildcard)],
            ["Broadcast", intToIPv4(data.broadcast)],
            ["First usable", intToIPv4(data.firstHost)],
            ["Last usable", intToIPv4(data.lastHost)],
            ["Total addresses", formatNumber(data.total)],
            ["Usable addresses", formatNumber(data.usable)],
            ["Address type", ipv4Class(data.ip.octets)],
            ["Binary mask", data.mask.toString(2).padStart(32, "0").replace(/(.{8})/g, "$1.").slice(0, -1)],
            ["Prefix", `/${data.prefix}`],
            ["Legacy class", classLetter(data.ip.octets[0])]
        ]);
        setStatus(`Calculated ${intToIPv4(data.network)}/${data.prefix}.`, "success");
    } catch (error) {
        $("subnetResults").replaceChildren();
        setStatus(error.message, "error");
    }
}

$("subnetCalculate").addEventListener("click", calculateSubnet);
document.querySelectorAll("[data-cidr]").forEach((button) => button.addEventListener("click", () => {
    $("subnetCidr").value = button.dataset.cidr;
    calculateSubnet();
}));

function log2BigInt(value) {
    let n = value;
    let power = -1;
    while (n > 0n) {
        n >>= 1n;
        power += 1;
    }
    return power;
}

function rangeToCidrs(start, end) {
    let current = BigInt(start);
    const last = BigInt(end);
    const blocks = [];
    while (current <= last) {
        let block = current === 0n ? (1n << 32n) : (current & -current);
        const remaining = last - current + 1n;
        while (block > remaining) block >>= 1n;
        const prefix = 32 - log2BigInt(block);
        blocks.push(`${intToIPv4(Number(current))}/${prefix}`);
        current += block;
    }
    return blocks;
}

function calculateRange() {
    try {
        const start = parseIPv4($("rangeStart").value);
        const end = parseIPv4($("rangeEnd").value);
        if (start.int > end.int) throw new Error("Start address must not be greater than end address.");
        const count = end.int - start.int + 1;
        const cidrs = rangeToCidrs(start.int, end.int);
        renderResults($("rangeResults"), [
            ["Start", start.raw],
            ["End", end.raw],
            ["Addresses", formatNumber(count)],
            ["CIDR blocks", formatNumber(cidrs.length)],
            ["Start type", ipv4Class(start.octets)],
            ["End type", ipv4Class(end.octets)]
        ]);
        $("rangeCidrs").value = cidrs.join("\n");
        setStatus(`Range summarized into ${cidrs.length} CIDR block${cidrs.length === 1 ? "" : "s"}.`, "success");
    } catch (error) {
        $("rangeResults").replaceChildren();
        $("rangeCidrs").value = "";
        setStatus(error.message, "error");
    }
}

$("rangeCalculate").addEventListener("click", calculateRange);
$("copyRangeCidrs").addEventListener("click", async () => copyText($("rangeCidrs").value, "CIDR blocks copied."));

function parseNetwork(value) {
    const match = String(value).trim().match(/^(.+)\/(\d{1,2})$/);
    if (!match) throw new Error("Enter a network such as 192.168.1.0/24.");
    const ip = parseIPv4(match[1]);
    const prefix = Number(match[2]);
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) throw new Error("Source prefix must be between 0 and 32.");
    const mask = prefixMask(prefix);
    const network = (ip.int & mask) >>> 0;
    return { ip, prefix, network };
}

function calculateSplit() {
    const tbody = $("splitTable").querySelector("tbody");
    try {
        const source = parseNetwork($("splitNetwork").value);
        const targetInput = $("splitTarget").value.trim();
        if (!/^\d{1,2}$/.test(targetInput)) throw new Error("Enter a target CIDR prefix.");
        const target = Number(targetInput);
        if (!Number.isInteger(target) || target < source.prefix || target > 32) throw new Error(`Target prefix must be between /${source.prefix} and /32.`);
        const subnetCount = 2 ** (target - source.prefix);
        if (subnetCount > 4096) throw new Error("That split creates more than 4,096 subnets. Choose a smaller target prefix.");
        const blockSize = 2 ** (32 - target);
        const rows = [];
        for (let i = 0; i < subnetCount; i += 1) {
            const network = source.network + i * blockSize;
            const broadcast = network + blockSize - 1;
            const first = target <= 30 ? network + 1 : network;
            const last = target <= 30 ? broadcast - 1 : broadcast;
            const tr = document.createElement("tr");
            [String(i + 1), `${intToIPv4(network)}/${target}`, `${intToIPv4(first)} – ${intToIPv4(last)}`, intToIPv4(broadcast), formatNumber(blockSize)].forEach((value) => {
                const td = document.createElement("td");
                td.textContent = value;
                tr.appendChild(td);
            });
            rows.push(tr);
        }
        tbody.replaceChildren(...rows);
        renderResults($("splitResults"), [
            ["Source network", `${intToIPv4(source.network)}/${source.prefix}`],
            ["Target prefix", `/${target}`],
            ["Subnets", formatNumber(subnetCount)],
            ["Addresses / subnet", formatNumber(blockSize)]
        ]);
        setStatus(`Created ${formatNumber(subnetCount)} subnet${subnetCount === 1 ? "" : "s"}.`, "success");
    } catch (error) {
        tbody.replaceChildren();
        $("splitResults").replaceChildren();
        setStatus(error.message, "error");
    }
}

$("splitCalculate").addEventListener("click", calculateSplit);

function renderIPv4(ip) {
    const binary = ip.octets.map((octet) => octet.toString(2).padStart(8, "0")).join(".");
    const hex = ip.octets.map((octet) => octet.toString(16).padStart(2, "0").toUpperCase()).join(":");
    renderResults($("ipv4Results"), [
        ["IPv4", ip.raw],
        ["Unsigned integer", String(ip.int)],
        ["Binary", binary],
        ["Hexadecimal", hex],
        ["Address type", ipv4Class(ip.octets)],
        ["Legacy class", classLetter(ip.octets[0])]
    ]);
}

$("ipv4Convert").addEventListener("click", () => {
    try {
        const ip = parseIPv4($("ipv4Input").value);
        $("integerInput").value = String(ip.int);
        renderIPv4(ip);
        setStatus("IPv4 converted.", "success");
    } catch (error) { setStatus(error.message, "error"); }
});

$("integerConvert").addEventListener("click", () => {
    try {
        const rawInteger = $("integerInput").value.trim();
        if (!/^\d+$/.test(rawInteger)) throw new Error("Enter a decimal IPv4 integer.");
        const ipText = intToIPv4(Number(rawInteger));
        $("ipv4Input").value = ipText;
        renderIPv4(parseIPv4(ipText));
        setStatus("Integer converted to IPv4.", "success");
    } catch (error) { setStatus(error.message, "error"); }
});

let normalizedMac = "";
function normalizeMac() {
    try {
        const raw = $("macInput").value.trim();
        const validMac = /^(?:[0-9a-f]{12}|(?:[0-9a-f]{2}:){5}[0-9a-f]{2}|(?:[0-9a-f]{2}-){5}[0-9a-f]{2}|(?:[0-9a-f]{4}\.){2}[0-9a-f]{4})$/i;
        if (!validMac.test(raw)) throw new Error("Enter a valid 48-bit MAC address.");
        const clean = raw.replace(/[:.\-]/g, "");
        const lower = clean.toLowerCase();
        const upper = clean.toUpperCase();
        const format = $("macFormat").value;
        if (format === "colon") normalizedMac = lower.match(/.{2}/g).join(":");
        if (format === "hyphen") normalizedMac = upper.match(/.{2}/g).join("-");
        if (format === "cisco") normalizedMac = lower.match(/.{4}/g).join(".");
        if (format === "plain") normalizedMac = upper;
        const firstOctet = parseInt(clean.slice(0, 2), 16);
        renderResults($("macResults"), [
            ["Normalized", normalizedMac],
            ["Type", (firstOctet & 1) ? "Multicast" : "Unicast"],
            ["Administration", (firstOctet & 2) ? "Locally administered" : "Universally administered"],
            ["48-bit hex", `0x${upper}`]
        ]);
        setStatus("MAC address normalized.", "success");
    } catch (error) {
        normalizedMac = "";
        $("macResults").replaceChildren();
        setStatus(error.message, "error");
    }
}

$("macNormalize").addEventListener("click", normalizeMac);
$("macFormat").addEventListener("change", normalizeMac);
$("copyMac").addEventListener("click", () => copyText(normalizedMac, "MAC address copied."));

const bandwidthFactors = {
    bps: 1,
    Kbps: 1e3,
    Mbps: 1e6,
    Gbps: 1e9,
    Bps: 8,
    KBps: 8e3,
    MBps: 8e6,
    GBps: 8e9
};

let currentBitsPerSecond = 100e6;
function smartNumber(value, maximumFractionDigits = 4) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value);
}

function calculateBandwidth() {
    try {
        const value = Number($("bandwidthValue").value);
        const unit = $("bandwidthUnit").value;
        if (!Number.isFinite(value) || value < 0) throw new Error("Enter a valid non-negative bandwidth value.");
        currentBitsPerSecond = value * bandwidthFactors[unit];
        renderResults($("bandwidthResults"), [
            ["bit/s", smartNumber(currentBitsPerSecond, 2)],
            ["Kbit/s", smartNumber(currentBitsPerSecond / 1e3)],
            ["Mbit/s", smartNumber(currentBitsPerSecond / 1e6)],
            ["Gbit/s", smartNumber(currentBitsPerSecond / 1e9)],
            ["KB/s", smartNumber(currentBitsPerSecond / 8e3)],
            ["MB/s", smartNumber(currentBitsPerSecond / 8e6)],
            ["GB/s", smartNumber(currentBitsPerSecond / 8e9)]
        ]);
        calculateTransfer(false);
        setStatus("Bandwidth converted.", "success");
    } catch (error) { setStatus(error.message, "error"); }
}

function formatDuration(seconds) {
    if (!Number.isFinite(seconds)) return "∞";
    if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.round(seconds % 60);
    const parts = [];
    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    if (secs || !parts.length) parts.push(`${secs}s`);
    return parts.join(" ");
}

function calculateTransfer(updateStatus = true) {
    try {
        const size = Number($("fileSizeValue").value);
        const unit = $("fileSizeUnit").value;
        if (!Number.isFinite(size) || size < 0) throw new Error("Enter a valid non-negative file size.");
        const bytesFactor = { MB: 1e6, GB: 1e9, TB: 1e12 }[unit];
        const seconds = currentBitsPerSecond === 0 ? Infinity : (size * bytesFactor * 8) / currentBitsPerSecond;
        $("transferResult").textContent = `At ${smartNumber(currentBitsPerSecond / 1e6)} Mbit/s, ${smartNumber(size)} ${unit} takes about ${formatDuration(seconds)} (ideal throughput).`;
        if (updateStatus) setStatus("Transfer time estimated.", "success");
    } catch (error) { if (updateStatus) setStatus(error.message, "error"); }
}

$("bandwidthConvert").addEventListener("click", calculateBandwidth);
$("transferCalculate").addEventListener("click", () => calculateTransfer(true));

const ports = [
    [20, "TCP", "FTP data", "Traditional FTP data channel"],
    [21, "TCP", "FTP control", "Traditional FTP command channel"],
    [22, "TCP", "SSH / SFTP", "Secure shell and file transfer"],
    [23, "TCP", "Telnet", "Unencrypted remote terminal"],
    [25, "TCP", "SMTP", "Mail transfer between servers"],
    [53, "TCP/UDP", "DNS", "Domain name resolution"],
    [67, "UDP", "DHCP server", "DHCP server traffic"],
    [68, "UDP", "DHCP client", "DHCP client traffic"],
    [69, "UDP", "TFTP", "Trivial File Transfer Protocol"],
    [80, "TCP", "HTTP", "Unencrypted web traffic"],
    [110, "TCP", "POP3", "Mail retrieval"],
    [123, "UDP", "NTP", "Network time synchronization"],
    [137, "UDP", "NetBIOS Name", "NetBIOS name service"],
    [138, "UDP", "NetBIOS Datagram", "NetBIOS datagram service"],
    [139, "TCP", "NetBIOS Session", "Legacy Windows file/session service"],
    [143, "TCP", "IMAP", "Mail retrieval"],
    [161, "UDP", "SNMP", "Network monitoring and management"],
    [162, "UDP", "SNMP Trap", "SNMP notifications"],
    [389, "TCP/UDP", "LDAP", "Directory services"],
    [443, "TCP", "HTTPS", "TLS-encrypted web traffic"],
    [445, "TCP", "SMB", "Windows file and printer sharing"],
    [465, "TCP", "SMTPS", "SMTP over implicit TLS"],
    [514, "UDP", "Syslog", "Common syslog transport"],
    [587, "TCP", "SMTP Submission", "Authenticated mail submission"],
    [636, "TCP", "LDAPS", "LDAP over TLS"],
    [993, "TCP", "IMAPS", "IMAP over TLS"],
    [995, "TCP", "POP3S", "POP3 over TLS"],
    [1433, "TCP", "Microsoft SQL Server", "Default SQL Server listener"],
    [1521, "TCP", "Oracle Database", "Common Oracle listener"],
    [2049, "TCP/UDP", "NFS", "Network File System"],
    [2375, "TCP", "Docker API", "Unencrypted Docker daemon API"],
    [2376, "TCP", "Docker API TLS", "TLS-secured Docker daemon API"],
    [3000, "TCP", "Development / Grafana", "Common application and Grafana port"],
    [3306, "TCP", "MySQL / MariaDB", "Default MySQL-compatible database port"],
    [3389, "TCP/UDP", "RDP", "Microsoft Remote Desktop"],
    [5432, "TCP", "PostgreSQL", "Default PostgreSQL port"],
    [5601, "TCP", "Kibana", "Default Kibana web interface"],
    [6379, "TCP", "Redis", "Default Redis port"],
    [8000, "TCP", "Development HTTP", "Common development web port"],
    [8080, "TCP", "HTTP alternate", "Common proxy/application HTTP port"],
    [8443, "TCP", "HTTPS alternate", "Common alternate HTTPS port"],
    [9000, "TCP", "Application / MinIO", "Common application and MinIO API port"],
    [9090, "TCP", "Prometheus", "Default Prometheus web interface"],
    [9200, "TCP", "Elasticsearch", "Default Elasticsearch HTTP API"],
    [9418, "TCP", "Git", "Native Git protocol"],
    [27017, "TCP", "MongoDB", "Default MongoDB port"]
];

function renderPorts(filter = "") {
    const query = filter.trim().toLowerCase();
    const matches = ports.filter((row) => row.some((value) => String(value).toLowerCase().includes(query)));
    const rows = matches.map(([port, protocol, service, notes]) => {
        const tr = document.createElement("tr");
        [port, protocol, service, notes].forEach((value) => {
            const td = document.createElement("td");
            td.textContent = String(value);
            tr.appendChild(td);
        });
        return tr;
    });
    $("portTable").querySelector("tbody").replaceChildren(...rows);
}

$("portSearch").addEventListener("input", (event) => renderPorts(event.target.value));

const dnsTypes = { 1: "A", 2: "NS", 5: "CNAME", 6: "SOA", 15: "MX", 16: "TXT", 28: "AAAA" };

function normalizeDomain(value) {
    let domain = String(value).trim().toLowerCase();
    domain = domain.replace(/^https?:\/\//, "").split("/")[0].replace(/\.$/, "");
    const labels = domain.split(".");
    if (!domain || domain.length > 253 || labels.some((label) => label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) {
        throw new Error("Enter a valid domain name.");
    }
    return domain;
}

async function dnsLookup() {
    const tbody = $("dnsTable").querySelector("tbody");
    try {
        const domain = normalizeDomain($("dnsDomain").value);
        const type = $("dnsType").value;
        setStatus(`Looking up ${type} records for ${domain}...`, "working");
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        let response;
        try {
            response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${encodeURIComponent(type)}`, {
                headers: { Accept: "application/dns-json" },
                signal: controller.signal
            });
        } finally {
            clearTimeout(timer);
        }
        if (!response.ok) throw new Error(`DNS resolver returned HTTP ${response.status}.`);
        const data = await response.json();
        const answers = Array.isArray(data.Answer) ? data.Answer : [];
        const rows = answers.map((answer) => {
            const tr = document.createElement("tr");
            [answer.name || domain, dnsTypes[answer.type] || String(answer.type), `${answer.TTL ?? "—"}s`, answer.data ?? "—"].forEach((value) => {
                const td = document.createElement("td");
                td.textContent = value;
                tr.appendChild(td);
            });
            return tr;
        });
        tbody.replaceChildren(...rows);
        renderResults($("dnsMeta"), [
            ["Domain", domain],
            ["Requested type", type],
            ["DNS status", String(data.Status ?? "—")],
            ["Answers", String(answers.length)]
        ]);
        if (data.Status !== 0) setStatus(`DNS lookup completed with status ${data.Status}.`, "error");
        else if (!answers.length) setStatus(`No ${type} answers returned for ${domain}.`, "success");
        else setStatus(`Found ${answers.length} ${type} record${answers.length === 1 ? "" : "s"}.`, "success");
    } catch (error) {
        tbody.replaceChildren();
        $("dnsMeta").replaceChildren();
        const message = error.name === "AbortError" ? "DNS lookup timed out." : error.message;
        setStatus(message, "error");
    }
}

$("dnsLookup").addEventListener("click", dnsLookup);

async function copyText(value, successMessage) {
    if (!value) {
        setStatus("Nothing to copy yet.", "error");
        return;
    }
    try {
        await navigator.clipboard.writeText(value);
        setStatus(successMessage, "success");
    } catch {
        setStatus("Clipboard access was blocked by the browser.", "error");
    }
}

["subnetIp", "subnetCidr"].forEach((id) => $(id).addEventListener("keydown", (event) => { if (event.key === "Enter") calculateSubnet(); }));
["rangeStart", "rangeEnd"].forEach((id) => $(id).addEventListener("keydown", (event) => { if (event.key === "Enter") calculateRange(); }));
$("splitNetwork").addEventListener("keydown", (event) => { if (event.key === "Enter") calculateSplit(); });
$("dnsDomain").addEventListener("keydown", (event) => { if (event.key === "Enter") dnsLookup(); });

calculateSubnet();
calculateRange();
calculateSplit();
renderIPv4(parseIPv4($("ipv4Input").value));
normalizeMac();
calculateBandwidth();
renderPorts();
setStatus("Ready.");

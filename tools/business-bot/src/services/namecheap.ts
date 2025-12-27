import { config } from '../config';
import type { NamecheapDomainInfo, NamecheapOwnedDomain, NamecheapDnsRecord } from '../types';

const SANDBOX_URL = 'https://api.sandbox.namecheap.com/xml.response';
const PRODUCTION_URL = 'https://api.namecheap.com/xml.response';

function getApiUrl(): string {
  return config.namecheap.sandbox ? SANDBOX_URL : PRODUCTION_URL;
}

function buildBaseParams(): URLSearchParams {
  return new URLSearchParams({
    ApiUser: config.namecheap.apiUser,
    ApiKey: config.namecheap.apiKey,
    UserName: config.namecheap.username,
    ClientIp: config.namecheap.clientIp,
  });
}

async function makeRequest(command: string, params: Record<string, string> = {}): Promise<string> {
  const urlParams = buildBaseParams();
  urlParams.set('Command', command);

  for (const [key, value] of Object.entries(params)) {
    urlParams.set(key, value);
  }

  const url = `${getApiUrl()}?${urlParams.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Namecheap API error: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

function parseXmlValue(xml: string, tag: string): string | undefined {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match?.[1];
}

function parseXmlAttribute(xml: string, tag: string, attr: string): string | undefined {
  const regex = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i');
  const match = xml.match(regex);
  return match?.[1];
}

function checkApiError(xml: string): void {
  const status = parseXmlAttribute(xml, 'ApiResponse', 'Status');
  if (status === 'ERROR') {
    const errorMsg = parseXmlValue(xml, 'Error') ?? 'Unknown Namecheap API error';
    throw new Error(errorMsg);
  }
}

export async function checkDomainAvailability(domain: string): Promise<NamecheapDomainInfo> {
  const xml = await makeRequest('namecheap.domains.check', {
    DomainList: domain,
  });

  checkApiError(xml);

  const available = parseXmlAttribute(xml, 'DomainCheckResult', 'Available') === 'true';

  return {
    domain,
    available,
  };
}

export async function searchDomains(keyword: string, tlds: string[] = ['com', 'net', 'org', 'io']): Promise<NamecheapDomainInfo[]> {
  const domains = tlds.map((tld) => `${keyword}.${tld}`);
  const xml = await makeRequest('namecheap.domains.check', {
    DomainList: domains.join(','),
  });

  checkApiError(xml);

  const results: NamecheapDomainInfo[] = [];
  const domainRegex = /<DomainCheckResult\s+Domain="([^"]+)"\s+Available="([^"]+)"/gi;

  let match;
  while ((match = domainRegex.exec(xml)) !== null) {
    results.push({
      domain: match[1],
      available: match[2] === 'true',
    });
  }

  return results;
}

export async function getDomainPricing(domain: string): Promise<NamecheapDomainInfo> {
  const tld = domain.split('.').pop() ?? 'com';
  const sld = domain.replace(`.${tld}`, '');

  const xml = await makeRequest('namecheap.users.getPricing', {
    ProductType: 'DOMAIN',
    ProductCategory: 'REGISTER',
    ActionName: 'REGISTER',
  });

  checkApiError(xml);

  const availability = await checkDomainAvailability(domain);

  const priceRegex = new RegExp(
    `<ProductType[^>]*Name="${tld}"[^>]*>[\\s\\S]*?<Price[^>]*Duration="1"[^>]*Price="([^"]+)"`,
    'i'
  );
  const priceMatch = xml.match(priceRegex);

  return {
    ...availability,
    price: priceMatch ? parseFloat(priceMatch[1]) : undefined,
    currency: 'USD',
  };
}

export async function listOwnedDomains(): Promise<NamecheapOwnedDomain[]> {
  const xml = await makeRequest('namecheap.domains.getList', {
    PageSize: '100',
    Page: '1',
  });

  checkApiError(xml);

  const results: NamecheapOwnedDomain[] = [];
  const domainRegex = /<Domain\s+ID="[^"]+"\s+Name="([^"]+)"[^>]*Created="([^"]+)"[^>]*Expires="([^"]+)"[^>]*IsExpired="([^"]+)"[^>]*IsLocked="([^"]+)"[^>]*AutoRenew="([^"]+)"[^>]*WhoisGuard="([^"]+)"/gi;

  let match;
  while ((match = domainRegex.exec(xml)) !== null) {
    results.push({
      domain: match[1],
      created: match[2],
      expires: match[3],
      isExpired: match[4] === 'true',
      isLocked: match[5] === 'true',
      autoRenew: match[6] === 'true',
      whoisGuard: match[7],
    });
  }

  return results;
}

export async function getDomainInfo(domain: string): Promise<{
  domain: string;
  created: string;
  expires: string;
  status: string;
  nameservers: string[];
}> {
  const tld = domain.split('.').pop() ?? 'com';
  const sld = domain.replace(`.${tld}`, '');

  const xml = await makeRequest('namecheap.domains.getInfo', {
    DomainName: domain,
  });

  checkApiError(xml);

  const nameservers: string[] = [];
  const nsRegex = /<Nameserver>([^<]+)<\/Nameserver>/gi;
  let nsMatch;
  while ((nsMatch = nsRegex.exec(xml)) !== null) {
    nameservers.push(nsMatch[1]);
  }

  return {
    domain,
    created: parseXmlAttribute(xml, 'DomainGetInfoResult', 'Created') ?? '',
    expires: parseXmlAttribute(xml, 'DomainGetInfoResult', 'Expires') ?? '',
    status: parseXmlAttribute(xml, 'DomainGetInfoResult', 'Status') ?? 'Unknown',
    nameservers,
  };
}

export async function registerDomain(
  domain: string,
  years = 1,
  registrantInfo: {
    firstName: string;
    lastName: string;
    address1: string;
    city: string;
    stateProvince: string;
    postalCode: string;
    country: string;
    phone: string;
    email: string;
  }
): Promise<{
  success: boolean;
  domain: string;
  orderId?: string;
  transactionId?: string;
  chargedAmount?: number;
}> {
  const tld = domain.split('.').pop() ?? 'com';
  const sld = domain.replace(`.${tld}`, '');

  const params: Record<string, string> = {
    DomainName: domain,
    Years: years.toString(),
    RegistrantFirstName: registrantInfo.firstName,
    RegistrantLastName: registrantInfo.lastName,
    RegistrantAddress1: registrantInfo.address1,
    RegistrantCity: registrantInfo.city,
    RegistrantStateProvince: registrantInfo.stateProvince,
    RegistrantPostalCode: registrantInfo.postalCode,
    RegistrantCountry: registrantInfo.country,
    RegistrantPhone: registrantInfo.phone,
    RegistrantEmailAddress: registrantInfo.email,
    TechFirstName: registrantInfo.firstName,
    TechLastName: registrantInfo.lastName,
    TechAddress1: registrantInfo.address1,
    TechCity: registrantInfo.city,
    TechStateProvince: registrantInfo.stateProvince,
    TechPostalCode: registrantInfo.postalCode,
    TechCountry: registrantInfo.country,
    TechPhone: registrantInfo.phone,
    TechEmailAddress: registrantInfo.email,
    AdminFirstName: registrantInfo.firstName,
    AdminLastName: registrantInfo.lastName,
    AdminAddress1: registrantInfo.address1,
    AdminCity: registrantInfo.city,
    AdminStateProvince: registrantInfo.stateProvince,
    AdminPostalCode: registrantInfo.postalCode,
    AdminCountry: registrantInfo.country,
    AdminPhone: registrantInfo.phone,
    AdminEmailAddress: registrantInfo.email,
    AuxBillingFirstName: registrantInfo.firstName,
    AuxBillingLastName: registrantInfo.lastName,
    AuxBillingAddress1: registrantInfo.address1,
    AuxBillingCity: registrantInfo.city,
    AuxBillingStateProvince: registrantInfo.stateProvince,
    AuxBillingPostalCode: registrantInfo.postalCode,
    AuxBillingCountry: registrantInfo.country,
    AuxBillingPhone: registrantInfo.phone,
    AuxBillingEmailAddress: registrantInfo.email,
    AddFreeWhoisguard: 'yes',
    WGEnabled: 'yes',
  };

  const xml = await makeRequest('namecheap.domains.create', params);

  checkApiError(xml);

  const registered = parseXmlAttribute(xml, 'DomainCreateResult', 'Registered') === 'true';

  return {
    success: registered,
    domain,
    orderId: parseXmlAttribute(xml, 'DomainCreateResult', 'OrderID'),
    transactionId: parseXmlAttribute(xml, 'DomainCreateResult', 'TransactionID'),
    chargedAmount: parseFloat(parseXmlAttribute(xml, 'DomainCreateResult', 'ChargedAmount') ?? '0'),
  };
}

export async function getDnsRecords(domain: string): Promise<NamecheapDnsRecord[]> {
  const tld = domain.split('.').pop() ?? 'com';
  const sld = domain.replace(`.${tld}`, '');

  const xml = await makeRequest('namecheap.domains.dns.getHosts', {
    SLD: sld,
    TLD: tld,
  });

  checkApiError(xml);

  const records: NamecheapDnsRecord[] = [];
  const recordRegex = /<host\s+HostId="[^"]+"\s+Name="([^"]+)"\s+Type="([^"]+)"\s+Address="([^"]+)"\s+MXPref="([^"]+)"\s+TTL="([^"]+)"/gi;

  let match;
  while ((match = recordRegex.exec(xml)) !== null) {
    records.push({
      hostName: match[1],
      type: match[2],
      address: match[3],
      mxPref: match[4] !== '0' ? parseInt(match[4]) : undefined,
      ttl: parseInt(match[5]),
    });
  }

  return records;
}

export async function setDnsRecords(
  domain: string,
  records: NamecheapDnsRecord[]
): Promise<boolean> {
  const tld = domain.split('.').pop() ?? 'com';
  const sld = domain.replace(`.${tld}`, '');

  const params: Record<string, string> = {
    SLD: sld,
    TLD: tld,
  };

  records.forEach((record, index) => {
    const i = index + 1;
    params[`HostName${i}`] = record.hostName;
    params[`RecordType${i}`] = record.type;
    params[`Address${i}`] = record.address;
    params[`TTL${i}`] = record.ttl.toString();
    if (record.mxPref !== undefined) {
      params[`MXPref${i}`] = record.mxPref.toString();
    }
  });

  const xml = await makeRequest('namecheap.domains.dns.setHosts', params);

  checkApiError(xml);

  const success = parseXmlAttribute(xml, 'DomainDNSSetHostsResult', 'IsSuccess') === 'true';

  return success;
}

export async function setNameservers(
  domain: string,
  nameservers: string[]
): Promise<boolean> {
  const tld = domain.split('.').pop() ?? 'com';
  const sld = domain.replace(`.${tld}`, '');

  const xml = await makeRequest('namecheap.domains.dns.setCustom', {
    SLD: sld,
    TLD: tld,
    Nameservers: nameservers.join(','),
  });

  checkApiError(xml);

  const success = parseXmlAttribute(xml, 'DomainDNSSetCustomResult', 'Updated') === 'true';

  return success;
}

export async function getAccountBalance(): Promise<{
  availableBalance: number;
  accountBalance: number;
  earnedAmount: number;
  currency: string;
}> {
  const xml = await makeRequest('namecheap.users.getBalances');

  checkApiError(xml);

  return {
    availableBalance: parseFloat(parseXmlAttribute(xml, 'UserGetBalancesResult', 'AvailableBalance') ?? '0'),
    accountBalance: parseFloat(parseXmlAttribute(xml, 'UserGetBalancesResult', 'AccountBalance') ?? '0'),
    earnedAmount: parseFloat(parseXmlAttribute(xml, 'UserGetBalancesResult', 'EarnedAmount') ?? '0'),
    currency: parseXmlAttribute(xml, 'UserGetBalancesResult', 'Currency') ?? 'USD',
  };
}

import type { ToolResult, NamecheapDnsRecord } from '../../types';
import * as namecheap from '../../services/namecheap';

export async function getDnsRecords(domain: string): Promise<ToolResult> {
  try {
    const records = await namecheap.getDnsRecords(domain);

    return {
      success: true,
      data: {
        domain,
        recordCount: records.length,
        records: records.map((r) => ({
          name: r.hostName,
          type: r.type,
          value: r.address,
          ttl: r.ttl,
          priority: r.mxPref,
        })),
        summary: records.length > 0
          ? `${domain} has ${records.length} DNS record(s)`
          : `No DNS records found for ${domain}`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get DNS records',
    };
  }
}

export async function setDnsRecords(
  domain: string,
  records: NamecheapDnsRecord[]
): Promise<ToolResult> {
  try {
    const success = await namecheap.setDnsRecords(domain, records);

    if (success) {
      return {
        success: true,
        data: {
          domain,
          recordsSet: records.length,
          message: `Successfully set ${records.length} DNS record(s) for ${domain}`,
        },
      };
    } else {
      return {
        success: false,
        error: 'Failed to set DNS records',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set DNS records',
    };
  }
}

export async function setNameservers(
  domain: string,
  nameservers: string[]
): Promise<ToolResult> {
  try {
    const success = await namecheap.setNameservers(domain, nameservers);

    if (success) {
      return {
        success: true,
        data: {
          domain,
          nameservers,
          message: `Successfully set nameservers for ${domain}: ${nameservers.join(', ')}`,
        },
      };
    } else {
      return {
        success: false,
        error: 'Failed to set nameservers',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set nameservers',
    };
  }
}

export async function addDnsRecord(
  domain: string,
  record: NamecheapDnsRecord
): Promise<ToolResult> {
  try {
    const existingRecords = await namecheap.getDnsRecords(domain);

    const newRecords = [...existingRecords, record];

    const success = await namecheap.setDnsRecords(domain, newRecords);

    if (success) {
      return {
        success: true,
        data: {
          domain,
          addedRecord: record,
          totalRecords: newRecords.length,
          message: `Added ${record.type} record for ${record.hostName}.${domain}`,
        },
      };
    } else {
      return {
        success: false,
        error: 'Failed to add DNS record',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add DNS record',
    };
  }
}

export async function removeDnsRecord(
  domain: string,
  hostName: string,
  recordType: string
): Promise<ToolResult> {
  try {
    const existingRecords = await namecheap.getDnsRecords(domain);

    const newRecords = existingRecords.filter(
      (r) => !(r.hostName === hostName && r.type === recordType)
    );

    if (newRecords.length === existingRecords.length) {
      return {
        success: false,
        error: `No matching ${recordType} record found for ${hostName}`,
      };
    }

    const success = await namecheap.setDnsRecords(domain, newRecords);

    if (success) {
      return {
        success: true,
        data: {
          domain,
          removedRecord: { hostName, type: recordType },
          remainingRecords: newRecords.length,
          message: `Removed ${recordType} record for ${hostName}.${domain}`,
        },
      };
    } else {
      return {
        success: false,
        error: 'Failed to remove DNS record',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove DNS record',
    };
  }
}

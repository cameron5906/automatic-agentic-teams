import type { ToolResult } from '../../types';
import * as namecheap from '../../services/namecheap';
import * as projectStore from '../../context/project-store';

export async function searchDomains(
  keyword: string,
  tlds?: string[]
): Promise<ToolResult> {
  try {
    const results = await namecheap.searchDomains(keyword, tlds);

    const available = results.filter((r) => r.available);
    const unavailable = results.filter((r) => !r.available);

    return {
      success: true,
      data: {
        keyword,
        available: available.map((r) => r.domain),
        unavailable: unavailable.map((r) => r.domain),
        summary: available.length > 0
          ? `Found ${available.length} available domain(s): ${available.map((r) => r.domain).join(', ')}`
          : 'No available domains found with those TLDs',
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search domains',
    };
  }
}

export async function checkDomain(domain: string): Promise<ToolResult> {
  try {
    const result = await namecheap.checkDomainAvailability(domain);

    return {
      success: true,
      data: {
        domain,
        available: result.available,
        message: result.available
          ? `${domain} is available for registration!`
          : `${domain} is not available`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check domain',
    };
  }
}

export async function getDomainPricing(domain: string): Promise<ToolResult> {
  try {
    const result = await namecheap.getDomainPricing(domain);

    return {
      success: true,
      data: {
        domain,
        available: result.available,
        price: result.price,
        currency: result.currency,
        message: result.available
          ? `${domain} is available for ${result.price ? `$${result.price}` : 'check pricing'}/year`
          : `${domain} is not available`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get pricing',
    };
  }
}

export async function listDomains(): Promise<ToolResult> {
  try {
    const domains = await namecheap.listOwnedDomains();

    return {
      success: true,
      data: {
        count: domains.length,
        domains: domains.map((d) => ({
          domain: d.domain,
          expires: d.expires,
          isExpired: d.isExpired,
          autoRenew: d.autoRenew,
        })),
        summary: domains.length > 0
          ? `You own ${domains.length} domain(s)`
          : 'No domains found in account',
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list domains',
    };
  }
}

export async function getDomainInfo(domain: string): Promise<ToolResult> {
  try {
    const info = await namecheap.getDomainInfo(domain);

    return {
      success: true,
      data: {
        domain: info.domain,
        created: info.created,
        expires: info.expires,
        status: info.status,
        nameservers: info.nameservers,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get domain info',
    };
  }
}

export async function registerDomain(
  domain: string,
  projectId: string,
  years = 1,
  hasApproval = false
): Promise<ToolResult> {
  const project = projectStore.getProject(projectId);
  if (!project) {
    return {
      success: false,
      error: `Project ${projectId} not found`,
    };
  }

  if (!hasApproval && !projectStore.hasApproval(projectId, 'domain')) {
    return {
      success: false,
      requiresApproval: true,
      approvalPrompt: `I'd like to register **${domain}** for ${years} year(s). This will cost real money from your Namecheap account. Do you approve this domain registration?`,
      error: 'Domain registration requires human approval',
    };
  }

  try {
    const pricing = await namecheap.getDomainPricing(domain);

    if (!pricing.available) {
      return {
        success: false,
        error: `Domain ${domain} is no longer available`,
      };
    }

    const result = await namecheap.registerDomain(domain, years, {
      firstName: 'Business',
      lastName: 'Bot',
      address1: '123 Main St',
      city: 'New York',
      stateProvince: 'NY',
      postalCode: '10001',
      country: 'US',
      phone: '+1.5555555555',
      email: 'domains@example.com',
    });

    if (result.success) {
      projectStore.setDomainResource(projectId, {
        name: domain,
        registeredAt: Date.now(),
        expiresAt: Date.now() + years * 365 * 24 * 60 * 60 * 1000,
        autoRenew: true,
      });

      return {
        success: true,
        data: {
          domain,
          orderId: result.orderId,
          chargedAmount: result.chargedAmount,
          message: `Successfully registered ${domain}! Order ID: ${result.orderId}`,
        },
      };
    } else {
      return {
        success: false,
        error: 'Domain registration failed',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to register domain',
    };
  }
}

export async function getAccountBalance(): Promise<ToolResult> {
  try {
    const balance = await namecheap.getAccountBalance();

    return {
      success: true,
      data: {
        availableBalance: balance.availableBalance,
        accountBalance: balance.accountBalance,
        currency: balance.currency,
        message: `Available balance: $${balance.availableBalance.toFixed(2)} ${balance.currency}`,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get account balance',
    };
  }
}

import Stripe from 'stripe';

interface StripeAccountConfig {
  accountId: string;
  secretKey: string;
  projectId?: string;
  businessName: string;
  isLive: boolean;
}

const stripeClients = new Map<string, Stripe>();

export function getStripeClient(secretKey: string): Stripe {
  if (!stripeClients.has(secretKey)) {
    stripeClients.set(
      secretKey,
      new Stripe(secretKey)
    );
  }
  return stripeClients.get(secretKey)!;
}

export async function validateApiKey(secretKey: string): Promise<{
  valid: boolean;
  accountId?: string;
  businessName?: string;
  isLive: boolean;
  error?: string;
}> {
  try {
    const stripe = getStripeClient(secretKey);
    const account = await stripe.accounts.retrieve();

    return {
      valid: true,
      accountId: account.id,
      businessName: account.business_profile?.name ?? account.settings?.dashboard?.display_name ?? 'Unknown',
      isLive: !secretKey.startsWith('sk_test_'),
    };
  } catch (error) {
    return {
      valid: false,
      isLive: !secretKey.startsWith('sk_test_'),
      error: error instanceof Error ? error.message : 'Invalid API key',
    };
  }
}

export async function getAccountBalance(secretKey: string): Promise<{
  available: Array<{ amount: number; currency: string }>;
  pending: Array<{ amount: number; currency: string }>;
}> {
  const stripe = getStripeClient(secretKey);
  const balance = await stripe.balance.retrieve();

  return {
    available: balance.available.map((b) => ({
      amount: b.amount / 100,
      currency: b.currency.toUpperCase(),
    })),
    pending: balance.pending.map((b) => ({
      amount: b.amount / 100,
      currency: b.currency.toUpperCase(),
    })),
  };
}

export async function listCustomers(
  secretKey: string,
  options: { limit?: number; startingAfter?: string; email?: string } = {}
): Promise<{
  customers: Array<{
    id: string;
    email: string | null;
    name: string | null;
    created: string;
    balance: number;
    currency: string;
    subscriptions: number;
  }>;
  hasMore: boolean;
}> {
  const stripe = getStripeClient(secretKey);

  const params: Stripe.CustomerListParams = {
    limit: options.limit ?? 20,
  };
  if (options.startingAfter) params.starting_after = options.startingAfter;
  if (options.email) params.email = options.email;

  const result = await stripe.customers.list(params);

  return {
    customers: result.data.map((c) => ({
      id: c.id,
      email: c.email,
      name: c.name ?? null,
      created: new Date(c.created * 1000).toISOString(),
      balance: (c.balance ?? 0) / 100,
      currency: c.currency ?? 'usd',
      subscriptions: typeof c.subscriptions === 'object' && c.subscriptions?.data
        ? c.subscriptions.data.length
        : 0,
    })),
    hasMore: result.has_more,
  };
}

export async function getCustomer(
  secretKey: string,
  customerId: string
): Promise<{
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  created: string;
  balance: number;
  currency: string;
  metadata: Record<string, string>;
  defaultPaymentMethod?: string;
}> {
  const stripe = getStripeClient(secretKey);
  const customer = await stripe.customers.retrieve(customerId);

  if (customer.deleted) {
    throw new Error('Customer has been deleted');
  }

  return {
    id: customer.id,
    email: customer.email,
    name: customer.name ?? null,
    phone: customer.phone ?? null,
    created: new Date(customer.created * 1000).toISOString(),
    balance: (customer.balance ?? 0) / 100,
    currency: customer.currency ?? 'usd',
    metadata: customer.metadata as Record<string, string>,
    defaultPaymentMethod: typeof customer.default_source === 'string'
      ? customer.default_source
      : customer.default_source?.id,
  };
}

export async function createCustomer(
  secretKey: string,
  data: {
    email?: string;
    name?: string;
    phone?: string;
    metadata?: Record<string, string>;
  }
): Promise<{ id: string; email: string | null; name: string | null }> {
  const stripe = getStripeClient(secretKey);
  const customer = await stripe.customers.create(data);

  return {
    id: customer.id,
    email: customer.email,
    name: customer.name ?? null,
  };
}

export async function updateCustomer(
  secretKey: string,
  customerId: string,
  data: {
    email?: string;
    name?: string;
    phone?: string;
    metadata?: Record<string, string>;
  }
): Promise<{ id: string; email: string | null; name: string | null }> {
  const stripe = getStripeClient(secretKey);
  const customer = await stripe.customers.update(customerId, data);

  return {
    id: customer.id,
    email: customer.email,
    name: customer.name ?? null,
  };
}

export async function listPayments(
  secretKey: string,
  options: {
    limit?: number;
    startingAfter?: string;
    customerId?: string;
    status?: 'succeeded' | 'pending' | 'failed';
  } = {}
): Promise<{
  payments: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    customerId: string | null;
    customerEmail: string | null;
    description: string | null;
    created: string;
    paymentMethod: string | null;
  }>;
  hasMore: boolean;
}> {
  const stripe = getStripeClient(secretKey);

  const params: Stripe.PaymentIntentListParams = {
    limit: options.limit ?? 20,
  };
  if (options.startingAfter) params.starting_after = options.startingAfter;
  if (options.customerId) params.customer = options.customerId;

  const result = await stripe.paymentIntents.list(params);

  let payments = result.data;
  if (options.status) {
    payments = payments.filter((p) => p.status === options.status);
  }

  return {
    payments: payments.map((p) => ({
      id: p.id,
      amount: p.amount / 100,
      currency: p.currency.toUpperCase(),
      status: p.status,
      customerId: typeof p.customer === 'string' ? p.customer : p.customer?.id ?? null,
      customerEmail: null,
      description: p.description,
      created: new Date(p.created * 1000).toISOString(),
      paymentMethod: typeof p.payment_method === 'string'
        ? p.payment_method
        : p.payment_method?.id ?? null,
    })),
    hasMore: result.has_more,
  };
}

export async function listSubscriptions(
  secretKey: string,
  options: {
    limit?: number;
    startingAfter?: string;
    customerId?: string;
    status?: 'active' | 'canceled' | 'past_due' | 'trialing' | 'all';
  } = {}
): Promise<{
  subscriptions: Array<{
    id: string;
    customerId: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    items: Array<{
      priceId: string;
      productId: string;
      quantity: number;
      amount: number;
      currency: string;
      interval: string;
    }>;
    created: string;
  }>;
  hasMore: boolean;
}> {
  const stripe = getStripeClient(secretKey);

  const params: Stripe.SubscriptionListParams = {
    limit: options.limit ?? 20,
  };
  if (options.startingAfter) params.starting_after = options.startingAfter;
  if (options.customerId) params.customer = options.customerId;
  if (options.status && options.status !== 'all') params.status = options.status;

  const result = await stripe.subscriptions.list(params);

  return {
    subscriptions: result.data.map((s) => ({
      id: s.id,
      customerId: typeof s.customer === 'string' ? s.customer : s.customer.id,
      status: s.status,
      currentPeriodStart: new Date(s.current_period_start * 1000).toISOString(),
      currentPeriodEnd: new Date(s.current_period_end * 1000).toISOString(),
      cancelAtPeriodEnd: s.cancel_at_period_end,
      items: s.items.data.map((item) => ({
        priceId: item.price.id,
        productId: typeof item.price.product === 'string'
          ? item.price.product
          : item.price.product.id,
        quantity: item.quantity ?? 1,
        amount: (item.price.unit_amount ?? 0) / 100,
        currency: item.price.currency.toUpperCase(),
        interval: item.price.recurring?.interval ?? 'one_time',
      })),
      created: new Date(s.created * 1000).toISOString(),
    })),
    hasMore: result.has_more,
  };
}

export async function listProducts(
  secretKey: string,
  options: { limit?: number; active?: boolean } = {}
): Promise<{
  products: Array<{
    id: string;
    name: string;
    description: string | null;
    active: boolean;
    prices: Array<{
      id: string;
      unitAmount: number;
      currency: string;
      recurring: { interval: string; intervalCount: number } | null;
    }>;
    metadata: Record<string, string>;
    created: string;
  }>;
  hasMore: boolean;
}> {
  const stripe = getStripeClient(secretKey);

  const params: Stripe.ProductListParams = {
    limit: options.limit ?? 20,
    expand: ['data.default_price'],
  };
  if (options.active !== undefined) params.active = options.active;

  const result = await stripe.products.list(params);

  const productsWithPrices = await Promise.all(
    result.data.map(async (product) => {
      const prices = await stripe.prices.list({
        product: product.id,
        active: true,
        limit: 10,
      });

      return {
        id: product.id,
        name: product.name,
        description: product.description,
        active: product.active,
        prices: prices.data.map((price) => ({
          id: price.id,
          unitAmount: (price.unit_amount ?? 0) / 100,
          currency: price.currency.toUpperCase(),
          recurring: price.recurring
            ? {
                interval: price.recurring.interval,
                intervalCount: price.recurring.interval_count,
              }
            : null,
        })),
        metadata: product.metadata as Record<string, string>,
        created: new Date(product.created * 1000).toISOString(),
      };
    })
  );

  return {
    products: productsWithPrices,
    hasMore: result.has_more,
  };
}

export async function createProduct(
  secretKey: string,
  data: {
    name: string;
    description?: string;
    metadata?: Record<string, string>;
  }
): Promise<{ id: string; name: string }> {
  const stripe = getStripeClient(secretKey);
  const product = await stripe.products.create(data);

  return {
    id: product.id,
    name: product.name,
  };
}

export async function createPrice(
  secretKey: string,
  data: {
    productId: string;
    unitAmount: number;
    currency: string;
    recurring?: { interval: 'day' | 'week' | 'month' | 'year'; intervalCount?: number };
  }
): Promise<{ id: string; unitAmount: number; currency: string }> {
  const stripe = getStripeClient(secretKey);

  const params: Stripe.PriceCreateParams = {
    product: data.productId,
    unit_amount: Math.round(data.unitAmount * 100),
    currency: data.currency.toLowerCase(),
  };

  if (data.recurring) {
    params.recurring = {
      interval: data.recurring.interval,
      interval_count: data.recurring.intervalCount ?? 1,
    };
  }

  const price = await stripe.prices.create(params);

  return {
    id: price.id,
    unitAmount: (price.unit_amount ?? 0) / 100,
    currency: price.currency.toUpperCase(),
  };
}

export async function getRevenueStats(
  secretKey: string,
  options: { days?: number } = {}
): Promise<{
  totalRevenue: number;
  currency: string;
  transactionCount: number;
  averageTransaction: number;
  periodStart: string;
  periodEnd: string;
}> {
  const stripe = getStripeClient(secretKey);
  const days = options.days ?? 30;
  const startDate = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;

  const charges = await stripe.charges.list({
    created: { gte: startDate },
    limit: 100,
  });

  const successfulCharges = charges.data.filter((c) => c.status === 'succeeded');
  const totalRevenue = successfulCharges.reduce((sum, c) => sum + c.amount, 0) / 100;
  const currency = successfulCharges[0]?.currency?.toUpperCase() ?? 'USD';

  return {
    totalRevenue,
    currency,
    transactionCount: successfulCharges.length,
    averageTransaction: successfulCharges.length > 0 ? totalRevenue / successfulCharges.length : 0,
    periodStart: new Date(startDate * 1000).toISOString(),
    periodEnd: new Date().toISOString(),
  };
}

export async function listInvoices(
  secretKey: string,
  options: {
    limit?: number;
    startingAfter?: string;
    customerId?: string;
    status?: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  } = {}
): Promise<{
  invoices: Array<{
    id: string;
    number: string | null;
    customerId: string | null;
    customerEmail: string | null;
    status: string | null;
    total: number;
    currency: string;
    dueDate: string | null;
    paidAt: string | null;
    hostedInvoiceUrl: string | null;
    created: string;
  }>;
  hasMore: boolean;
}> {
  const stripe = getStripeClient(secretKey);

  const params: Stripe.InvoiceListParams = {
    limit: options.limit ?? 20,
  };
  if (options.startingAfter) params.starting_after = options.startingAfter;
  if (options.customerId) params.customer = options.customerId;
  if (options.status) params.status = options.status;

  const result = await stripe.invoices.list(params);

  return {
    invoices: result.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      customerId: typeof inv.customer === 'string' ? inv.customer : inv.customer?.id ?? null,
      customerEmail: inv.customer_email,
      status: inv.status as string | null,
      total: inv.total / 100,
      currency: inv.currency.toUpperCase(),
      dueDate: inv.due_date ? new Date(inv.due_date * 1000).toISOString() : null,
      paidAt: inv.status_transitions?.paid_at
        ? new Date(inv.status_transitions.paid_at * 1000).toISOString()
        : null,
      hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
      created: new Date(inv.created * 1000).toISOString(),
    })),
    hasMore: result.has_more,
  };
}

export async function createPaymentLink(
  secretKey: string,
  data: {
    priceId: string;
    quantity?: number;
    metadata?: Record<string, string>;
  }
): Promise<{ id: string; url: string; active: boolean }> {
  const stripe = getStripeClient(secretKey);

  const paymentLink = await stripe.paymentLinks.create({
    line_items: [
      {
        price: data.priceId,
        quantity: data.quantity ?? 1,
      },
    ],
    metadata: data.metadata,
  });

  return {
    id: paymentLink.id,
    url: paymentLink.url,
    active: paymentLink.active,
  };
}

export async function getWebhookEndpoints(
  secretKey: string
): Promise<
  Array<{
    id: string;
    url: string;
    status: string;
    enabledEvents: string[];
    secret?: string;
  }>
> {
  const stripe = getStripeClient(secretKey);
  const endpoints = await stripe.webhookEndpoints.list({ limit: 20 });

  return endpoints.data.map((ep) => ({
    id: ep.id,
    url: ep.url,
    status: ep.status,
    enabledEvents: ep.enabled_events,
  }));
}

export async function createWebhookEndpoint(
  secretKey: string,
  data: {
    url: string;
    events: string[];
    description?: string;
  }
): Promise<{ id: string; url: string; secret: string }> {
  const stripe = getStripeClient(secretKey);

  const endpoint = await stripe.webhookEndpoints.create({
    url: data.url,
    enabled_events: data.events as Stripe.WebhookEndpointCreateParams.EnabledEvent[],
    description: data.description,
  });

  return {
    id: endpoint.id,
    url: endpoint.url,
    secret: endpoint.secret!,
  };
}

export { StripeAccountConfig };

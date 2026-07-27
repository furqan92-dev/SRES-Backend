import Stripe from "stripe";
import { prisma } from "../config/prisma.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder");

export const createPaymentIntent = async (req, res) => {
  try {
    const { planName, amount, email, name } = req.body;
    const userId = req.user.id;

    console.log('Payment request received:', { planName, amount, email, name, userId });

    if (!planName || !amount) {
      return res.status(400).json({
        success: false,
        message: "Missing plan or amount"
      });
    }

    // Try to get user info if not provided
    const user = await prisma.user.findUnique({ where: { id: userId }});
    const userEmail = email || user?.email || "user@example.com";
    const userName = name || "SRES User";

    // Convert amount to cents for Stripe
    const amountStr = amount.toString().replace(/,/g, '');
    const amountInCents = parseInt(amountStr) * 100;

    console.log('Creating payment intent for:', { planName, amountInCents, userId });

    // Create payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "usd",
      receipt_email: userEmail,
      metadata: {
        planName,
        userId,
        userName
      }
    });

    console.log('Payment intent created:', paymentIntent.id);

    res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error("Payment error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create payment intent"
    });
  }
};

export const createCheckoutSession = async (req, res) => {
  try {
    const { planName, amount, email, name } = req.body;
    const userId = req.user.id;

    console.log('Checkout session request received:', { planName, amount, email, name, userId });

    if (!planName || !amount) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    // Convert amount to cents for Stripe (remove commas if any)
    const amountStr = amount.toString().replace(/,/g, '');
    const amountInCents = parseInt(amountStr) * 100;

    const frontendUrl = req.headers.origin || "http://localhost:5173";

    const sessionConfig = {
      payment_method_types: ['card'],
      client_reference_id: userId.toString(),
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${planName} Plan`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${frontendUrl}/home?payment=success&plan=${planName}`,
      cancel_url: `${frontendUrl}/pricing`,
      metadata: {
        userId: userId.toString(),
        planName,
        userName: name || ""
      }
    };

    if (email) {
      sessionConfig.customer_email = email;
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create(sessionConfig);

    console.log('Checkout session created:', session.id);

    res.status(200).json({
      success: true,
      url: session.url,
      sessionId: session.id
    });
  } catch (error) {
    console.error("Checkout session error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create checkout session"
    });
  }
};


export const handlePaymentWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "payment_intent.succeeded" || event.type === "checkout.session.completed") {
    const paymentObject = event.data.object;
    const { userId, planName } = paymentObject.metadata || {};

    if (!userId || !planName) {
      console.log('Skipping webhook: metadata missing (userId or planName)');
      return res.status(200).json({ received: true });
    }

    try {
      const { billingCycle } = paymentObject.metadata || {};
      const interval = billingCycle || 'month';
      
      let creditsToAdd = 0;
      if (planName === 'Gold') creditsToAdd = interval === 'year' ? 4000 : 2000;
      else if (planName === 'Diamond') creditsToAdd = interval === 'year' ? 8000 : 4000;
      else if (planName === 'Platinum') creditsToAdd = interval === 'year' ? 16000 : 8000;
      else creditsToAdd = 4000; // Fallback

      await prisma.user.update({
        where: { id: parseInt(userId, 10) },
        data: {
          credits: {
            increment: creditsToAdd
          },
          totalCredits: {
            increment: creditsToAdd
          },
          planName: planName
        }
      });

      console.log(`✅ Payment succeeded for user ${userId}, added ${creditsToAdd} credits`);
    } catch (error) {
      console.error("Error updating user credits:", error);
    }
  }

  res.status(200).json({ received: true });
};

export const createSubscription = async (req, res) => {
  try {
    console.log('Subscription request received:', req.body);
    const { planName, amount, email, name, paymentMethodId, billingCycle } = req.body;
    const userId = req.user.id;

    if (!planName || !amount) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const interval = billingCycle === 'yearly' ? 'year' : 'month';

    let creditsToAdd = 0;
    if (planName === 'Gold') creditsToAdd = interval === 'year' ? 4000 : 2000;
    else if (planName === 'Diamond') creditsToAdd = interval === 'year' ? 8000 : 4000;
    else if (planName === 'Platinum') creditsToAdd = interval === 'year' ? 16000 : 8000;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: email || user.email,
        name: name || user.name || "SRES User",
        metadata: { userId }
      });
      customerId = customer.id;
      console.log('Created new Stripe customer:', customerId);

      const currentCredits = user.credits || 0;
      const newCredits = currentCredits + creditsToAdd;
      console.log(`Updating user ${userId} credits: ${currentCredits} -> ${newCredits}`);
      
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId, credits: newCredits, totalCredits: newCredits, planName: planName }
      });
    } else {
      console.log("Customer already exists. Canceling previous active subscriptions for upgrade.");
      const existingSubscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
      });
      
      for (const sub of existingSubscriptions.data) {
        if (sub.status !== 'canceled' && sub.status !== 'incomplete_expired') {
          try {
            await stripe.subscriptions.cancel(sub.id);
            console.log(`Canceled existing subscription: ${sub.id}`);
          } catch (cancelErr) {
            console.log(`Could not cancel subscription ${sub.id}: ${cancelErr.message}`);
          }
        }
      }

      const currentCredits = user.credits || 0;
      const newCredits = currentCredits + creditsToAdd;
      console.log(`Updating existing user ${userId} credits for new plan: ${currentCredits} -> ${newCredits}`);

      await prisma.user.update({
        where: { id: userId },
        data: { credits: newCredits, totalCredits: newCredits, planName: planName }
      });
    }

    try {
      const pm = await stripe.paymentMethods.create({
        type: 'card',
        card: { token: 'tok_visa' }
      });
      
      await stripe.paymentMethods.attach(pm.id, {
        customer: customerId,
      });

      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: pm.id },
      });
    } catch (err) {
      console.log("Payment method already attached or simulation error:", err.message);
    }

    // Convert amount to cents (use provided amount as authoritative)
    const amountStr = amount.toString().replace(/,/g, '');
    const amountInCents = parseInt(amountStr) * 100;

    // Always try to fetch Price from Prisma DB
    let existingPriceDb = await prisma.price.findFirst({
      where: {
        product: { name: `${planName} Plan` },
        interval: interval
      }
    });

    let usePriceId;

    if (!existingPriceDb) {
      // If no Price is found in DB, create the Product/Price in Stripe and persist to Prisma
      try {
        console.log(`No price found in DB for ${planName} (${interval}). Creating product/price in Stripe...`);
        const product = await stripe.products.create({ name: `${planName} Plan` });
        const price = await stripe.prices.create({
          unit_amount: amountInCents,
          currency: 'usd',
          recurring: { interval: interval },
          product: product.id,
        });

        // Persist Product and Price in Prisma
        await prisma.product.create({
          data: {
            id: product.id,
            name: product.name || `${planName} Plan`,
            description: product.description || ''
          }
        });

        await prisma.price.create({
          data: {
            id: price.id,
            unit_amount: price.unit_amount,
            currency: price.currency,
            type: price.type || 'recurring',
            interval: interval,
            productId: product.id
          }
        });

        usePriceId = price.id;
        console.log(`Created and saved Stripe price ${usePriceId} for ${planName} (${interval})`);
      } catch (err) {
        console.error('Error creating price in Stripe or saving to DB:', err.message);
        return res.status(500).json({ success: false, message: 'Price configuration missing and creation failed. Check server logs.' });
      }
    } else {
      usePriceId = existingPriceDb.id;
      console.log(`Found existing price in DB for ${planName} ${interval}: ${usePriceId}`);
    }

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: usePriceId }],
      payment_behavior: "allow_incomplete",
      expand: ["latest_invoice.payment_intent"],
      metadata: { userId, planName, billingCycle: interval }
    });

    console.log("✅ Subscription Created:", subscription.id);

    res.status(200).json({
      success: true,
      subscriptionId: subscription.id,
      clientSecret: subscription.latest_invoice.payment_intent?.client_secret,
      status: subscription.status
    });
  } catch (error) {
    console.error("Subscription error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

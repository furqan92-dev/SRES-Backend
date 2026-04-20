import Stripe from 'stripe';
import dotenv from 'dotenv';
import { prisma } from './config/prisma.js';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function runPaymentSimulation() {
  try {
    // 1. Create Product
    const product = await stripe.products.create({
      name: "Diamond Plan",
    });

    // 2. Create Price
    const price = await stripe.prices.create({
      unit_amount: 5000,
      currency: "usd",
      recurring: { interval: "month" },
      product: product.id,
    });

    console.log("✅ Price Created:", price.id);

    const userEmail = "muhammadfurqancheema92@gmail.com";

    // 3. Create Customer
    const customer = await stripe.customers.create({
      name: "Muhammad Furqan Cheema",
      email: userEmail,
    });

    // 4. Attach Test Card (pm_card_visa)
    const paymentMethod = await stripe.paymentMethods.attach(
      "pm_card_visa",
      { customer: customer.id }
    );

    // 5. Set as Default
    await stripe.customers.update(customer.id, {
      invoice_settings: { default_payment_method: paymentMethod.id },
    });

    console.log("✅ Payment Method Attached and Set as Default");

    // 6. Create Subscription
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: price.id }],
      payment_behavior: "allow_incomplete",
      expand: ["latest_invoice.payment_intent"],
    });

    console.log("✅ Subscription Created:", subscription.id);
    console.log("Status:", subscription.status);
    console.log(subscription.latest_invoice);
    console.log(subscription.latest_invoice.payment_intent);

    if (subscription.latest_invoice.status === "paid") {
      const user = await prisma.user.findUnique({
        where: { email: userEmail },
        select: { credits: true }
      });
      const currentCredits = user ? user.credits : 0;

      await prisma.user.update({
        where: { email: userEmail },
        data: {
          credits: currentCredits + 2000,
          totalCredits: currentCredits + 2000
        }
      });
      console.log(`🚀 DB Success: Credits updated to ${currentCredits + 2000} for ${userEmail}`);
    }

  } catch (error) {
    console.error("❌ Simulation Error:", error.message);
  }
}

runPaymentSimulation();

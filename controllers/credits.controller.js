import { prisma } from "../config/prisma.js";

export const getAllUsers = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    // Get all users except the current user
    const users = await prisma.user.findMany({
      where: {
        NOT: {
          id: currentUserId
        }
      },
      select: {
        id: true,
        email: true
      }
    });

    res.status(200).json({
      success: true,
      users
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users"
    });
  }
};

export const shareCredits = async (req, res) => {
  try {
    const { targetUserId, amount } = req.body;
    const senderId = req.user.id;

    if (!targetUserId || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid target user or amount"
      });
    }

    const shareAmount = parseInt(amount);

    // Use transaction to deduct from sender and add to receiver
    const result = await prisma.$transaction(async (tx) => {
      // 1. Check sender's balance
      const sender = await tx.user.findUnique({
        where: { id: senderId }
      });

      if (sender.credits < shareAmount) {
        throw new Error("Insufficient credits");
      }

      // 2. Deduct from sender
      const updatedSender = await tx.user.update({
        where: { id: senderId },
        data: {
          credits: { decrement: shareAmount }
        }
      });

      // 3. Add to receiver (both current and total credits)
      const receiver = await tx.user.update({
        where: { id: parseInt(targetUserId) },
        data: {
          credits: { increment: shareAmount },
          totalCredits: { increment: shareAmount }
        },
        select: { email: true }
      });

      return { newSenderBalance: updatedSender.credits, receiverEmail: receiver.email };
    });

    res.status(200).json({
      success: true,
      message: `Successfully shared ${shareAmount} credits to ${result.receiverEmail}!`,
      newCredits: result.newSenderBalance
    });

  } catch (error) {
    console.error("Error sharing credits:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to share credits"
    });
  }
};

// Deduct 1 credit per call reveal (1 Call = 1 Credit)
export const trackCall = async (req, res) => {
  try {
    const { propertyId } = req.body;
    let userId = req.user ? req.user.id : null;

    if (!userId) {
      const firstUser = await prisma.user.findFirst();
      if (firstUser) userId = firstUser.id;
    }

    if (!userId) {
      // No user found, still allow call (guest mode)
      return res.status(200).json({ success: true, allowed: true, newCredits: null });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(200).json({ success: true, allowed: true, newCredits: null });
    }

    if (user.credits < 1) {
      return res.status(400).json({
        success: false,
        allowed: false,
        message: `Insufficient credits! You need at least 1 credit to reveal a phone number. You have ${user.credits} credits.`,
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { credits: { decrement: 1 } },
    });

    return res.status(200).json({
      success: true,
      allowed: true,
      newCredits: updatedUser.credits,
      message: `1 credit used. Remaining: ${updatedUser.credits}`,
    });
  } catch (error) {
    console.error("Error tracking call:", error);
    // On error, still allow call (don't block user)
    return res.status(200).json({ success: true, allowed: true, newCredits: null });
  }
};

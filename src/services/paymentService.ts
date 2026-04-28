import axios from 'axios';

const PUBLIC_KEY = (import.meta as any).env.VITE_PAYSTACK_PUBLIC_KEY;

export interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export async function initializePayment(email: string, amount: number, userId: string, currency?: string) {
  if (!email) {
    throw new Error('Email is required for payment initialization');
  }

  try {
    const response = await axios.post<PaystackInitializeResponse>('/api/paystack/initialize', {
      email,
      amount,
      currency,
      metadata: {
        userId,
        custom_fields: [
          {
            display_name: "Module",
            variable_name: "module",
            value: "FitAI Premium Subscription"
          }
        ]
      }
    });

    if (response.data.status) {
      window.location.href = response.data.data.authorization_url;
    }
    return response.data;
  } catch (error: any) {
    const errorDetails = error.response?.data?.details || error.message;
    console.error('Payment initialization failed:', errorDetails);
    throw new Error(typeof errorDetails === 'object' ? JSON.stringify(errorDetails) : errorDetails);
  }
}

export async function verifyPayment(reference: string) {
  try {
    const response = await axios.post(`/api/paystack/verify/${reference}`);
    return response.data;
  } catch (error) {
    console.error('Payment verification failed', error);
    throw error;
  }
}

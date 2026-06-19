import { NextResponse } from 'next/server';
import { getOnboardingStatus } from '@/lib/zatca/onboarding-storage';

export async function GET() {
    const status = await getOnboardingStatus();
    return NextResponse.json(status);
}

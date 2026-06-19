import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const logFile = path.join(process.cwd(), 'zatca-api-logs.json');
        if (!fs.existsSync(logFile)) {
            return NextResponse.json([]);
        }
        const content = fs.readFileSync(logFile, 'utf8');
        return NextResponse.json(JSON.parse(content));
    } catch (error) {
        return NextResponse.json({ error: 'Failed to read logs' }, { status: 500 });
    }
}

export async function DELETE() {
    try {
        const logFile = path.join(process.cwd(), 'zatca-api-logs.json');
        if (fs.existsSync(logFile)) {
            fs.writeFileSync(logFile, '[]');
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to clear logs' }, { status: 500 });
    }
}

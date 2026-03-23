import { NextResponse } from 'next/server';
import { runQuery } from '@/lib/neo4j';

export async function GET() {
    try {
        // This simple query just asks the database to return the number 1
        const result = await runQuery('RETURN 1 AS number');
        const number = result[0].get('number').toNumber();

        return NextResponse.json({
            success: true,
            message: 'Neo4j connection successful!',
            testNumber: number
        });
    } catch (error) {
        console.error('Database connection failed:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        if (req.method === 'GET') {
            const { data, error } = await supabase
                .from('actions')
                .select('*')
                .order('id', { ascending: false });

            if (error) throw error;
            return res.status(200).json({ success: true, actions: data });
        }

        if (req.method === 'POST') {
            const { id, title, cover, goal, action, deadline, isCompleted, date } = req.body;

            const { data, error } = await supabase
                .from('actions')
                .insert([{ id, title, cover, goal, action, deadline, is_completed: isCompleted, date }]);

            if (error) throw error;
            return res.status(200).json({ success: true, data });
        }

        if (req.method === 'PUT') {
            const { id, isCompleted } = req.body;

            const { data, error } = await supabase
                .from('actions')
                .update({ is_completed: isCompleted })
                .eq('id', id);

            if (error) throw error;
            return res.status(200).json({ success: true, data });
        }

        return res.status(405).json({ success: false, message: 'Method not allowed' });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}

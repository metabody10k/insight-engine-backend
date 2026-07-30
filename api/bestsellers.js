
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const ttbKey = process.env.ALADIN_API_KEY;
        const aladinUrl = `http://www.aladin.co.kr/ttb/api/ItemList.aspx?ttbkey=${ttbKey}&QueryType=Bestseller&CategoryId=170&MaxResults=3&start=1&SearchTarget=Book&output=js&Version=20131101`;
        
        const response = await fetch(aladinUrl);
        const data = await response.json();

        if (!data.item || data.item.length === 0) {
            return res.status(200).json({ success: false, books: [] });
        }

        const books = data.item.map(book => ({
            title: book.title,
            author: book.author,
            cover: book.cover,
            price: `${book.priceStandard.toLocaleString()}원`
        }));

        return res.status(200).json({ success: true, books });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}

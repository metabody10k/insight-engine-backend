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
        const text = await response.text();

        // 알라딘 JS 파서 포맷(JSONP)에서 순수 JSON 데이터만 안전하게 추출
        const jsonStartIndex = text.indexOf('{');
        const jsonEndIndex = text.lastIndexOf('}');
        
        if (jsonStartIndex === -1 || jsonEndIndex === -1) {
            return res.status(200).json({ success: false, books: [] });
        }

        const jsonString = text.substring(jsonStartIndex, jsonEndIndex + 1);
        const data = JSON.parse(jsonString);

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


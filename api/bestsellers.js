export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const ttbKey = process.env.ALADIN_API_KEY;
        if (!ttbKey) {
            return res.status(500).json({ success: false, error: "ALADIN_API_KEY 환경 변수가 설정되지 않았습니다." });
        }

        // 검증된 ItemSearch.aspx 기반으로 '자기계발' 베스트셀러 조회
        const aladinUrl = `https://www.aladin.co.kr/ttb/api/ItemSearch.aspx?ttbkey=${ttbKey}&Query=자기계발&QueryType=Bestseller&MaxResults=3&start=1&SearchTarget=Book&output=js&Version=20131101`;
        
        const response = await fetch(aladinUrl);
        const text = await response.text();

        const jsonStartIndex = text.indexOf('{');
        const jsonEndIndex = text.lastIndexOf('}');
        
        if (jsonStartIndex === -1 || jsonEndIndex === -1) {
            return res.status(500).json({ success: false, error: "알라딘 API 응답 형식 오류" });
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
            price: `${book.priceStandard ? book.priceStandard.toLocaleString() : 0}원`
        }));

        return res.status(200).json({ success: true, books });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}

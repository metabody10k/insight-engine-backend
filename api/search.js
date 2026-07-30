// 파일명: api/search.js
export default async function handler(req, res) {
    // 1. 보안 차단 무력화 (CORS 전면 허용)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { keyword } = req.query;
    // 2. Vercel 서버에 안전하게 숨겨둘 대표님의 TTB 인증키
    const TTB_KEY = process.env.ALADIN_TTB_KEY; 

    if (!keyword) {
        return res.status(400).json({ success: false, error: '검색어를 입력해주세요.' });
    }

    try {
        // 3. 백엔드 서버가 직접 알라딘 API 호출 (차단 없음)
        const aladinUrl = `http://www.aladin.co.kr/ttb/api/ItemSearch.aspx?ttbkey=${TTB_KEY}&Query=${encodeURIComponent(keyword)}&QueryType=Keyword&MaxResults=5&output=js&Version=20131101`;
        
        const response = await fetch(aladinUrl);
        let textData = await response.text();
        
        // JSON 파싱 에러 방지 (알라딘 특유의 세미콜론 제거)
        if (textData.endsWith(';')) textData = textData.slice(0, -1);
        const data = JSON.parse(textData);

        if (!data || !data.item) {
            return res.status(200).json({ success: true, books: [] });
        }

        // 4. 앱에서 쓰기 좋게 필수 데이터 정제 및 HTTPS 강제 변환
        const books = data.item.map(book => ({
            title: book.title,
            author: book.author,
            price: book.priceStandard ? book.priceStandard.toLocaleString() + '원' : '가격 미상',
            cover: book.cover ? book.cover.replace('http://', 'https://') : '',
            link: book.link // 수익 창출용 알라딘 제휴 구매 링크
        }));

        res.status(200).json({ success: true, books });

    } catch (error) {
        console.error('Aladin API Error:', error);
        res.status(500).json({ success: false, error: '백엔드 통신 오류가 발생했습니다.' });
    }
}

// public/js/src/marquee.js
import { dom } from './domElements.js';
import { openPreviewById } from './utils.js'; // Assuming openPreviewById is available in utils.js
import { openPreview } from './newsDetail.js'; // openPreview from newsDetail.js is needed

export async function initNewsMarquee() {
    if (!dom.newsMarquee) return;

    try {
        const res = await fetch('/api/haberler?limit=10');
        const data = await res.json();
        const headlines = data.data;

        if (headlines && headlines.length > 0) {
            const marqueeItems = headlines.map(n => `
                <span class="marquee-item" onclick="window.openPreviewById(${n.id}, window.openPreview)">
                    <i class="fa-solid fa-bolt" style="color:var(--accent-color); margin-right:5px;"></i>
                    ${n.baslik}
                </span>
            `).join('');

            dom.newsMarquee.innerHTML = marqueeItems + marqueeItems; // Double for loop effect
        }
    } catch (err) {
        console.error('Marquee error:', err);
        dom.newsMarquee.innerHTML = '<span>Son dakika haberleri şu an yüklenemiyor.</span>';
    }
}

export async function initFinanceMarquee() {
    if (!dom.financeMarquee) return;

    try {
        const res = await fetch('/api/market-data');
        const data = await res.json();
        const marketData = data.data;

        if (marketData && marketData.length > 0) {
            const marqueeItems = marketData.map(m => {
                const isDown = m.change && (m.change.includes('-') || (m.change.includes('%') && m.change.split('%')[1].startsWith('-')));
                const changeClass = isDown ? 'down' : 'up';
                const icon = isDown ? 'fa-caret-down' : 'fa-caret-up';

                return `
                    <div class="finance-item">
                        <span class="finance-label-name">${m.label}</span>
                        <span class="finance-value">${m.value}</span>
                        ${m.change ? `<span class="finance-change ${changeClass}"><i class="fa-solid ${icon}"></i> ${m.change}</span>` : ''}
                    </div>
                `;
            }).join('');

            dom.financeMarquee.innerHTML = marqueeItems + marqueeItems; // Loop
        }
    } catch (err) {
        console.error('Finance marquee error:', err);
        dom.financeMarquee.innerHTML = '<span>Piyasa verileri şu an yüklenemiyor.</span>';
    }
}

// Auto-refresh finance data every 1 minute
// This should be called once from the main entry point
// setInterval(initFinanceMarquee, 60000); // Moved to main.js for control

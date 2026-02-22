// public/js/src/legal.js
import { dom } from './domElements.js';

// Legal Texts
const legalTexts = {
    privacy: `
        <h3>Gizlilik Politikası</h3>
        <p>Platformumuzda gizliliğiniz bizim için önceliklidir. Bu politika, kişisel verilerinizin nasıl toplandığını, işlendiğini ve korunduğunu açıklar.</p>
        <p><strong>Toplanan Veriler:</strong> Kayıt sırasında sağladığınız bilgiler (kullanıcı adı, e-posta, şifre), profil ayarları, site içi etkileşimleriniz (haber paylaşımı, beğeni, yorum, mesajlaşma) ve teknik veriler (IP adresi, tarayıcı bilgisi) saklanmaktadır.</p>
        <p><strong>Veri Kullanımı:</strong> Verileriniz; kişiselleştirilmiş içerik sunmak, güvenliği sağlamak, topluluk kurallarını uygulamak ve hizmetlerimizi geliştirmek amacıyla kullanılmaktadır. Verileriniz üçüncü taraflarla pazarlama amacıyla paylaşılmaz.</p>
        <p><strong>Veri Koruma:</strong> Tüm verileriniz güvenli sunucularda saklanır ve yetkisiz erişime karşı korunur.</p>
    `,
    terms: `
        <h3>Kullanıcı Sözleşmesi</h3>
        <p>Platformumuzu kullanarak aşağıdaki şartları kabul etmiş olursunuz:</p>
        <ul>
            <li>Hizmetlerimizi yasalara aykırı veya topluluk kurallarına aykırı amaçlarla kullanamazsınız.</li>
            <li>Diğer kullanıcıları rahatsız edici, tehdit edici veya spam içerikli davranışlarda bulunamazsınız.</li>
            <li>Paylaştığınız içeriklerden siz sorumlusunuz; telif hakkı ihlali yapamazsınız.</li>
            <li>Hesap güvenliğinizden siz sorumlusunuz; şifrenizi üçüncü kişilerle paylaşmamalısınız.</li>
            <li>Platform yönetimi, kurallara aykırı davranışlarda hesapları askıya alma veya kapatma hakkını saklı tutar.</li>
        </ul>
    `,
    cookies: `
        <h3>Çerez Politikası</h3>
        <p>Platformumuzda kullanıcı deneyimini geliştirmek, güvenliği sağlamak ve içerikleri kişiselleştirmek için çerezler (cookies) kullanılmaktadır.</p>
        <p><strong>Kullanılan Çerezler:</strong></p>
        <ul>
            <li>Zorunlu Çerezler: Oturum açma, güvenlik doğrulaması ve temel site işlevleri için gereklidir.</li>
            <li>Tercih Çerezleri: Dil seçimi, tema (örneğin karanlık mod) ve bildirim ayarları gibi tercihlerinizi hatırlamak için kullanılır.</li>
            <li>Analitik Çerezler: Site kullanımınızı analiz ederek hizmetlerimizi geliştirmemize yardımcı olur.</li>
            <li>İletişim Çerezleri: Mesajlaşma ve bildirim sistemlerinin doğru çalışmasını sağlar.</li>
        </ul>
    `
};



// Cookie Consent
export function initCookieConsent() {
    if (!dom.cookieBanner) return;
    if (!localStorage.getItem('trhaber_cookies_accepted')) {
        setTimeout(() => {
            dom.cookieBanner.classList.add('visible');
        }, 1000); // Show after 1 second
    }
}

export function acceptCookies() {
    if (!dom.cookieBanner) return;
    localStorage.setItem('trhaber_cookies_accepted', 'true');
    dom.cookieBanner.classList.remove('visible');
}

// Legal Modals / Frame
export function openLegalModal(type) {
    const contentHtml = legalTexts[type] || '<p>İçerik bulunamadı.</p>';
    // Prefer opening in right-side frame if available
    if (dom.legalFrame && dom.legalFrameContent) {
        if (dom.authModal) dom.authModal.classList.remove('open');
        dom.legalFrameContent.innerHTML = contentHtml;
        if (dom.previewFrame) dom.previewFrame.classList.remove('open');
        if (dom.messagesFrame) dom.messagesFrame.classList.remove('open');
        if (dom.followingFrame) dom.followingFrame.classList.remove('open');
        dom.legalFrame.style.display = 'block';
        dom.legalFrame.classList.add('open');
        if (dom.mainContent) dom.mainContent.classList.add('frame-active');
        if (dom.closeLegalFrameBtn) {
            dom.closeLegalFrameBtn.onclick = () => {
                dom.legalFrame.classList.remove('open');
                dom.legalFrame.style.display = 'none';
                if (dom.previewFrame && dom.previewFrame.classList.contains('open')) {
                    if (dom.mainContent) dom.mainContent.classList.add('frame-active');
                } else {
                    if (dom.mainContent) dom.mainContent.classList.remove('frame-active');
                }
            };
        }
        return;
    }
    // Fallback to modal
    if (dom.legalContent && dom.legalModal) {
        dom.legalContent.innerHTML = contentHtml;
        dom.legalModal.style.display = 'flex';
    }
}

export function closeLegalModal() {
    if (dom.legalFrame) {
        dom.legalFrame.classList.remove('open');
        dom.legalFrame.style.display = 'none';
        if (dom.mainContent) dom.mainContent.classList.remove('frame-active');
    }
    if (dom.legalModal) {
        dom.legalModal.style.display = 'none';
    }
}

export function initLegalModalListeners() {
    if (dom.legalModal) {
        dom.legalModal.addEventListener('click', (e) => {
            if (e.target.id === 'legal-modal') {
                closeLegalModal();
            }
        });
    }
}

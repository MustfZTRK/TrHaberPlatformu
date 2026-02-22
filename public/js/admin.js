document.addEventListener('DOMContentLoaded', () => {
    // Check Auth
    const user = JSON.parse(localStorage.getItem('trhaber_user'));
    if (!user || user.role !== 'admin') {
        alert('Bu sayfaya erişim yetkiniz yok.');
        window.location.href = '/';
        return;
    }

    const contentArea = document.getElementById('content-area');
    const adminLinks = document.querySelectorAll('.admin-link[data-target]');
    const modal = document.getElementById('admin-modal');
    const closeModal = document.getElementById('close-admin-modal');
    const adminForm = document.getElementById('admin-form');
    const formFields = document.getElementById('form-fields');
    const modalTitle = document.getElementById('modal-title');

    let currentType = 'kullanicilar'; // Default

    // Navigation
    adminLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            adminLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            currentType = link.getAttribute('data-target');
            // Map UI target to API type
            let apiType = currentType;
            if (currentType === 'users') apiType = 'kullanicilar';
            if (currentType === 'sources') apiType = 'kaynaklar';
            if (currentType === 'users') apiType = 'kullanicilar';
            if (currentType === 'sources') apiType = 'kaynaklar';
            if (currentType === 'categories') apiType = 'kategoriler';
            // 'ziyaretciler' type is same as API type

            loadData(apiType);
        });
    });

    closeModal.addEventListener('click', () => modal.classList.remove('open'));

    // Initial Load
    loadData('kullanicilar');

    function loadData(type) {
        fetch(`/api/admin/${type}`)
            .then(res => res.json())
            .then(data => {
                renderTable(type, data);
            });
    }

    function renderTable(type, data) {
        let html = `
            <div class="admin-header">
                <h2>${type.toUpperCase()} Yönetimi</h2>
                <button class="add-new-btn" onclick="openAddModal('${type}')">+ Yeni Ekle</button>
            </div>
            <table class="data-table">
                <thead>
                    <tr>
                        ${getHeaders(type)}
                        <th>İşlemler</th>
                    </tr>
                </thead>
                <tbody>
        `;

        data.forEach(item => {
            html += `<tr>${getRows(type, item)} 
                <td>
                    ${type !== 'ziyaretciler' ? `
                    <button class="action-btn btn-edit" onclick="editItem('${type}', ${item.id})">Düzenle</button>
                    <button class="action-btn btn-delete" onclick="deleteItem('${type}', ${item.id})">Sil</button>
                    ` : '<span style="color:#888; font-size:0.8rem;">İşlem Yok</span>'}
                    ${type === 'kullanicilar' ? `<button class="action-btn btn-block" onclick="blockUser(${item.id}, ${!item.is_blocked})">${item.is_blocked ? 'Engeli Kaldır' : 'Engelle'}</button>` : ''}
                </td>
            </tr>`;
        });

        html += `</tbody></table>`;
        contentArea.innerHTML = html;

        // Bind global functions for onclick
        window.editItem = (t, id) => {
            const item = data.find(d => d.id === id);
            openEditModal(t, item);
        };
        window.deleteItem = (t, id) => {
            if (confirm('Silmek istediğinize emin misiniz?')) {
                fetch(`/api/admin/${t}/${id}`, { method: 'DELETE' })
                    .then(() => loadData(t));
            }
        };
        window.blockUser = (id, blockStatus) => {
            fetch(`/api/admin/kullanicilar/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_blocked: blockStatus })
            }).then(() => loadData('kullanicilar'));
        };
        window.openAddModal = (t) => {
            modalTitle.innerText = 'Yeni Ekle';
            renderForm(t, null);
            modal.classList.add('open');
        };
    }

    function getHeaders(type) {
        if (type === 'kullanicilar') return '<th>ID</th><th>Kullanıcı Adı</th><th>Rol</th><th>Durum</th>';
        if (type === 'haberler') return '<th>ID</th><th>Başlık</th><th>Kaynak</th><th>Kategori</th>';
        if (type === 'kaynaklar') return '<th>ID</th><th>İsim</th><th>URL</th>';
        if (type === 'kategoriler') return '<th>ID</th><th>Ad</th>';
        if (type === 'ziyaretciler') return '<th>Tarih</th><th>IP</th><th>URL</th><th>Method</th><th>Yazılım</th>';
        return '';
    }

    function getRows(type, item) {
        if (type === 'kullanicilar') return `<td>${item.id}</td><td>${item.kullanici_adi}</td><td>${item.role}</td><td>${item.is_blocked ? 'Engelli' : 'Aktif'}</td>`;
        if (type === 'haberler') return `<td>${item.id}</td><td>${item.baslik}</td><td>${item.kaynak?.isim || '-'}</td><td>${item.kategori}</td>`;
        if (type === 'kaynaklar') return `<td>${item.id}</td><td>${item.isim}</td><td>${item.url}</td>`;
        if (type === 'kategoriler') return `<td>${item.id}</td><td>${item.ad}</td>`;
        if (type === 'ziyaretciler') return `<td>${new Date(item.timestamp).toLocaleString('tr-TR')}</td><td>${item.ip}</td><td>${item.url}</td><td>${item.method}</td><td><small>${(item.userAgent || '').substring(0, 30)}...</small></td>`;
        return '';
    }

    function openEditModal(type, item) {
        modalTitle.innerText = 'Düzenle: ' + item.id;
        renderForm(type, item);
        modal.classList.add('open');
    }

    function renderForm(type, item) {
        let html = `<input type="hidden" id="edit-id" value="${item ? item.id : ''}"> <input type="hidden" id="edit-type" value="${type}">`;

        if (type === 'kullanicilar') {
            html += createInput('kullanici_adi', 'Kullanıcı Adı', item?.kullanici_adi);
            html += createInput('role', 'Rol (user/admin)', item?.role);
        } else if (type === 'kaynaklar') {
            html += createInput('isim', 'İsim', item?.isim);
            html += createInput('url', 'Site URL', item?.url);
            html += createInput('logo', 'Logo URL', item?.logo);
        } else if (type === 'kategoriler') {
            html += createInput('ad', 'Kategori Adı', item?.ad);
        } else if (type === 'haberler') {
            html += createInput('baslik', 'Başlık', item?.baslik);
            html += createInput('ozet', 'Özet', item?.ozet);
            html += createInput('kategori', 'Kategori', item?.kategori);
            html += createTextArea('icerik', 'İçerik (HTML)', item?.icerik);
        }

        formFields.innerHTML = html;
    }

    function createInput(id, label, value = '') {
        return `<div class="admin-form-group"><label>${label}</label><input type="text" id="field-${id}" name="${id}" value="${value}"></div>`;
    }

    function createTextArea(id, label, value = '') {
        return `<div class="admin-form-group"><label>${label}</label><textarea id="field-${id}" name="${id}" rows="5">${value}</textarea></div>`;
    }

    adminForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const type = document.getElementById('edit-type').value;
        const id = document.getElementById('edit-id').value;
        const inputs = formFields.querySelectorAll('input, textarea');
        const data = {};

        inputs.forEach(input => {
            if (input.type !== 'hidden') data[input.name] = input.value;
        });

        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/admin/${type}/${id}` : `/api/admin/${type}`;

        fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).then(res => res.json())
            .then(res => {
                if (res.success) {
                    modal.classList.remove('open');
                    loadData(type);
                } else {
                    alert('Bir hata oluştu.');
                }
            });
    });
});

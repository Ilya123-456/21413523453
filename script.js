(function () {
    'use strict';

    function $(id) { return document.getElementById(id); }

    /* ==========================================================
       Вход / панель — без пароля
       ========================================================== */
    var loginView = $('admin-login');
    var adminPanel = $('admin-panel');
    var enterBtn = $('enter-panel');

    function showLogin() {
        if (loginView) loginView.hidden = false;
        if (adminPanel) adminPanel.hidden = true;
        if (enterBtn) enterBtn.focus();
    }

    function showPanel() {
        if (loginView) loginView.hidden = true;
        if (adminPanel) adminPanel.hidden = false;
    }

    if (enterBtn) {
        enterBtn.addEventListener('click', showPanel);
    }

    /* ==========================================================
       Админ-панель: данные и DOM
       ========================================================== */
    var STATUS_LABEL = { 'new': 'Новая', work: 'В работе', done: 'Завершена' };

    var state = {
        view: 'requests',
        filter: 'all',
        model: 'all',
        query: '',
        selectedId: null,
        requests: []
    };

    var els = {
        title: $('page-title'),
        search: $('search'),
        exportBtn: $('export'),
        logout: $('logout'),
        navLinks: [].slice.call(document.querySelectorAll('[data-view]')),
        panels: [].slice.call(document.querySelectorAll('[data-view-panel]')),
        requestsBody: $('requests-body'),
        clientsBody: $('clients-body'),
        detail: $('detail'),
        chips: [].slice.call(document.querySelectorAll('[data-filter]')),
        modelSelect: $('model-filter'),
        requestsBadge: $('requests-badge'),
        clientsBadge: $('clients-badge'),
        statTotal: $('stat-total'),
        statNew: $('stat-new'),
        statWork: $('stat-work'),
        statDone: $('stat-done')
    };

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
        });
    }

    function emptyRow(colspan, title, text) {
        return '<tr class="empty-row"><td colspan="' + colspan + '">' +
            '<strong>' + escapeHtml(title) + '</strong>' +
            '<p>' + escapeHtml(text) + '</p></td></tr>';
    }

    function getClients() {
        var map = Object.create(null);
        state.requests.forEach(function (r) {
            var key = r.phone || r.id;
            if (!map[key]) {
                map[key] = { name: r.name, phone: r.phone || '', email: r.email || '', total: 0, active: 0 };
            }
            map[key].total += 1;
            if (r.status !== 'done') map[key].active += 1;
        });
        return Object.keys(map).map(function (k) { return map[k]; });
    }

    function matchesQuery(values) {
        var q = state.query.trim().toLowerCase();
        if (!q) return true;
        return values.join(' ').toLowerCase().indexOf(q) !== -1;
    }

    function filteredRequests() {
        return state.requests.filter(function (r) {
            if (state.filter !== 'all' && r.status !== state.filter) return false;
            if (state.model !== 'all' && r.car !== state.model) return false;
            return matchesQuery([r.name, r.phone, r.email, r.carLabel]);
        });
    }

    function filteredClients() {
        return getClients().filter(function (c) {
            return matchesQuery([c.name, c.phone, c.email]);
        });
    }

    function renderStats() {
        var counts = { all: state.requests.length, 'new': 0, work: 0, done: 0 };
        state.requests.forEach(function (r) {
            if (counts[r.status] !== undefined) counts[r.status] += 1;
        });
        if (els.statTotal) els.statTotal.textContent = counts.all;
        if (els.statNew) els.statNew.textContent = counts['new'];
        if (els.statWork) els.statWork.textContent = counts.work;
        if (els.statDone) els.statDone.textContent = counts.done;
    }

    function renderRequests() {
        if (!els.requestsBody) return;
        var rows = filteredRequests();

        if (state.requests.length === 0) {
            els.requestsBody.innerHTML = emptyRow(5, 'Заявок пока нет', 'Когда посетитель отправит форму на сайте, заявка появится в этом списке.');
        } else if (rows.length === 0) {
            els.requestsBody.innerHTML = emptyRow(5, 'Ничего не найдено', 'Измените поисковый запрос или сбросьте фильтры.');
        } else {
            els.requestsBody.innerHTML = rows.map(function (r) {
                return '<tr data-id="' + escapeHtml(r.id) + '"' + (r.id === state.selectedId ? ' class="is-selected"' : '') + '>' +
                    '<td>#' + escapeHtml(r.id) + '</td>' +
                    '<td>' + escapeHtml(r.date) + '<br><span class="muted">' + escapeHtml(r.time) + '</span></td>' +
                    '<td><strong>' + escapeHtml(r.name) + '</strong><br><span class="muted">' + escapeHtml(r.phone) + '</span></td>' +
                    '<td>' + escapeHtml(r.carLabel) + '</td>' +
                    '<td><span class="status status--' + escapeHtml(r.status) + '">' + escapeHtml(STATUS_LABEL[r.status] || r.status) + '</span></td>' +
                    '</tr>';
            }).join('');
        }

        renderStats();
        renderDetail();
    }

    function renderClients() {
        if (!els.clientsBody) return;
        var list = filteredClients();

        if (list.length === 0) {
            els.clientsBody.innerHTML = state.requests.length === 0
                ? emptyRow(5, 'Клиентов пока нет', 'Клиенты появятся автоматически после первой заявки.')
                : emptyRow(5, 'Ничего не найдено', 'Измените поисковый запрос.');
        } else {
            els.clientsBody.innerHTML = list.map(function (c) {
                return '<tr>' +
                    '<td><strong>' + escapeHtml(c.name) + '</strong></td>' +
                    '<td>' + escapeHtml(c.phone) + '</td>' +
                    '<td>' + escapeHtml(c.email || '—') + '</td>' +
                    '<td>' + escapeHtml(c.total) + '</td>' +
                    '<td>' + escapeHtml(c.active) + '</td>' +
                    '</tr>';
            }).join('');
        }

        if (els.clientsBadge) els.clientsBadge.textContent = getClients().length;
    }

    function renderDetail() {
        if (!els.detail) return;
        var request = null;
        if (state.selectedId) {
            request = state.requests.filter(function (r) { return r.id === state.selectedId; })[0] || null;
        }

        if (!request) {
            els.detail.innerHTML =
                '<div class="empty-state">' +
                '<strong>Заявка не выбрана</strong>' +
                '<p>Выберите заявку в списке, чтобы увидеть детали.</p>' +
                '</div>';
            return;
        }

        els.detail.innerHTML =
            '<div class="detail__head">' +
            '<p class="eyebrow">ЗАЯВКА #' + escapeHtml(request.id) + '</p>' +
            '<span class="status status--' + escapeHtml(request.status) + '">' + escapeHtml(STATUS_LABEL[request.status] || request.status) + '</span>' +
            '</div>' +
            '<h2>' + escapeHtml(request.name) + '</h2>' +
            '<dl class="detail__list">' +
            '<div><dt>ТЕЛЕФОН</dt><dd>' + escapeHtml(request.phone) + '</dd></div>' +
            '<div><dt>ЭЛЕКТРОННАЯ ПОЧТА</dt><dd>' + escapeHtml(request.email || '—') + '</dd></div>' +
            '<div><dt>АВТОМОБИЛЬ</dt><dd>' + escapeHtml(request.carLabel) + '</dd></div>' +
            '<div><dt>ДАТА</dt><dd>' + escapeHtml(request.date) + ', ' + escapeHtml(request.time) + '</dd></div>' +
            '</dl>' +
            (request.message ? '<div class="detail__message"><p class="eyebrow">ЗАДАЧА</p><p>' + escapeHtml(request.message) + '</p></div>' : '') +
            '<div class="detail__actions">' +
            '<button class="btn btn--ghost" type="button" data-detail-close>Закрыть</button>' +
            '</div>';
    }

    function render() {
        if (els.requestsBadge) els.requestsBadge.textContent = state.requests.length;
        renderRequests();
        renderClients();
    }

    function setView(view) {
        state.view = view;
        state.selectedId = null;

        els.navLinks.forEach(function (link) {
            var active = link.getAttribute('data-view') === view;
            link.classList.toggle('is-active', active);
            if (active) {
                link.setAttribute('aria-current', 'page');
            } else {
                link.removeAttribute('aria-current');
            }
        });

        els.panels.forEach(function (panel) {
            panel.hidden = panel.getAttribute('data-view-panel') !== view;
        });

        if (els.title) els.title.textContent = view === 'clients' ? 'Клиенты' : 'Заявки';

        if (els.search) {
            els.search.value = '';
            state.query = '';
            els.search.placeholder = view === 'clients'
                ? 'Поиск по имени, телефону, e-mail'
                : 'Поиск по имени, телефону, модели';
        }

        try {
            history.replaceState(null, '', view === 'clients' ? '#clients' : '#requests');
        } catch (e) { /* ignore */ }

        render();
    }

    /* ---------- События панели ---------- */
    els.navLinks.forEach(function (link) {
        link.addEventListener('click', function (event) {
            event.preventDefault();
            setView(link.getAttribute('data-view') === 'clients' ? 'clients' : 'requests');
        });
    });

    els.chips.forEach(function (chip) {
        chip.addEventListener('click', function () {
            state.filter = chip.getAttribute('data-filter') || 'all';
            els.chips.forEach(function (other) {
                other.classList.toggle('is-active', other === chip);
            });
            renderRequests();
        });
    });

    if (els.modelSelect) {
        els.modelSelect.addEventListener('change', function () {
            state.model = els.modelSelect.value;
            renderRequests();
        });
    }

    if (els.search) {
        els.search.addEventListener('input', function () {
            state.query = els.search.value;
            if (state.view === 'clients') {
                renderClients();
            } else {
                renderRequests();
            }
        });
    }

    if (els.requestsBody) {
        els.requestsBody.addEventListener('click', function (event) {
            var row = event.target.closest('tr[data-id]');
            if (!row) return;
            state.selectedId = row.getAttribute('data-id');
            renderRequests();
        });
    }

    if (els.detail) {
        els.detail.addEventListener('click', function (event) {
            if (event.target.closest('[data-detail-close]')) {
                state.selectedId = null;
                renderRequests();
            }
        });
    }

    if (els.exportBtn) {
        els.exportBtn.addEventListener('click', function () {
            var headers, rows, filename;

            if (state.view === 'clients') {
                var clients = filteredClients();
                headers = ['Клиент', 'Телефон', 'E-mail', 'Всего заявок', 'Активных'];
                rows = clients.map(function (c) { return [c.name, c.phone, c.email, c.total, c.active]; });
                filename = 'granfort-klienty.csv';
            } else {
                var requests = filteredRequests();
                headers = ['№', 'Дата', 'Время', 'Клиент', 'Телефон', 'E-mail', 'Автомобиль', 'Статус'];
                rows = requests.map(function (r) {
                    return [r.id, r.date, r.time, r.name, r.phone, r.email || '', r.carLabel, STATUS_LABEL[r.status] || r.status];
                });
                filename = 'granfort-zayavki.csv';
            }

            var lines = [headers].concat(rows).map(function (row) {
                return row.map(function (cell) {
                    return '"' + String(cell == null ? '' : cell).replace(/"/g, '""') + '"';
                }).join(';');
            });

            var blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
            var url = URL.createObjectURL(blob);
            var link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        });
    }

    if (els.logout) {
        els.logout.addEventListener('click', function () {
            // Сброс состояния к исходному
            state.view = 'requests';
            state.filter = 'all';
            state.model = 'all';
            state.query = '';
            state.selectedId = null;
            if (els.search) els.search.value = '';
            els.chips.forEach(function (c) {
                c.classList.toggle('is-active', c.getAttribute('data-filter') === 'all');
            });
            if (els.modelSelect) els.modelSelect.value = 'all';
            setView('requests');

            showLogin();
        });
    }

    /* ---------- Стартовая инициализация ---------- */
    setView(window.location.hash === '#clients' ? 'clients' : 'requests');

    // Вход без пароля: панель открывается сразу
    showPanel();
})();
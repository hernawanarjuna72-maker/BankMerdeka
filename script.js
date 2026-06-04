// =========================================================
// 1. DATA MASTER & ENGINE KLASIFIKASI (NAMA + ALAMAT)
// =========================================================
const BASE_ADMIN_EMAILS = ["induk@bank.com", "admin@pemerintah.go.id"];
const PRIMARY_COMPANY_EMAIL = "induk@bank.com"; 
const ADMIN_FEE = 2500;

let currentGovFilter = 'ALL'; 

function isAdmin(user) {
    if (!user || !user.email) return false;
    const email = user.email.toLowerCase();
    if (email.includes("admin") && email.includes("go.id")) return true;
    return BASE_ADMIN_EMAILS.includes(user.email);
}

// MESIN DETEKSI OTORITAS PEMERINTAH (Termasuk BUMN & Pendidikan)
function isGovernmentAuthority(name) {
    const n = name.toUpperCase();
    return /(DINAS|DIRJEN|KEMENTERIAN|BADAN|SEKRETARIAT|KANTOR PAJAK|POLRES|POLDA|TNI|SD|MI|SMP|MTS|SMA|SMK|MA|MAK|UNIVERSITAS|POLITEKNIK|INSTITUT|AKADEMI|YAYASAN PENDIDIKAN|PONDOK|BUMN|BUMD|PERSERO|PERUM|PT KAI|PERTAMINA|PLN|BANK MANDIRI|BANK BRI|BANK BNI|PEGADAIAN)\b/.test(n);
}

// Hierarki NAMA dan ALAMAT
function getInstansiLevel(name, address = "") {
    const combinedStr = (name + " " + address).toUpperCase();
    if (combinedStr.includes("INDUK PERUSAHAAN BANK")) return 0; 
    
    if (combinedStr.includes("PUSAT") || combinedStr.includes("KEMENTERIAN")) return 1;
    if (combinedStr.includes("PROV")) return 2;
    if (combinedStr.includes("KOTA") || combinedStr.includes("KABUPATEN")) return 3;
    if (combinedStr.includes("KECAMATAN")) return 4;
    if (combinedStr.includes("DESA") || combinedStr.includes("KELURAHAN")) return 5;
    
    // Default level 6 untuk Sekolah/BUMN agar bisa mendapat hibah tapi bukan pemberi dana pusat
    if (isGovernmentAuthority(name)) return 6; 
    return 0; 
}

function getDetailedAccountType(user) {
    if (user.email === PRIMARY_COMPANY_EMAIL) return "perusahaan_swasta";
    
    // 1. Cek tipe mutlak dari pendaftaran (Swasta murni)
    if (user.accountType === 'swasta') return 'perusahaan_swasta';

    const combinedStr = (user.name + " " + (user.address || "")).toUpperCase();
    
    if (/(SD|MI|SMP|MTS|SMA|SMK|MA|MAK|UNIVERSITAS|POLITEKNIK|INSTITUT|AKADEMI|YAYASAN PENDIDIKAN|PONDOK)\b/.test(combinedStr)) return "pendidikan";
    if (/(BUMN|BUMD|PERSERO|PERUM|PT KAI|PERTAMINA|PLN|BANK MANDIRI|BANK BRI|BANK BNI|PEGADAIAN)\b/.test(combinedStr)) return "bumn";
    if (/(DINAS|DIRJEN|KEMENTERIAN|BADAN|SEKRETARIAT|KANTOR PAJAK|POLRES|POLDA|TNI)\b/.test(combinedStr) || getInstansiLevel(user.name, user.address) > 0) return "pemerintah";
    
    // Fallback legacy
    if (user.accountType === "perusahaan" || /(PT|CV|UD|FIRMA|KOPERASI)\b/.test(combinedStr) || isAdmin(user)) return "perusahaan_swasta";
    
    return "pribadi";
}

function initDB() {
    let storedUsers = localStorage.getItem('users');
    if (!storedUsers) {
        let initialUsers = [];
        BASE_ADMIN_EMAILS.forEach((email, index) => {
            initialUsers.push({
                accountNumber: `2000010100${index+1}`, 
                name: index === 0 ? "Induk Perusahaan Bank Merdeka" : "KEMENTERIAN KEUANGAN PUSAT", 
                address: index === 0 ? "Kantor Pusat Jakarta" : "Pusat Jakarta", 
                dob: "2000-01-01", email: email, pin: "123456", balance: 10000000000, 
                history: [], bills: [], accountType: "instansi", instansiLevel: index === 0 ? 0 : 1, document: "Verified Master"
            });
        });
        localStorage.setItem('users', JSON.stringify(initialUsers));
    } else {
        let parsedUsers = JSON.parse(storedUsers);
        let dataBerubah = false;
        parsedUsers.forEach(u => {
            if (!u.history) { u.history = []; dataBerubah = true; }
            if (!u.bills) { u.bills = []; dataBerubah = true; }
            if (!u.address) { u.address = "-"; dataBerubah = true; } 
            
            // Konversi tipe lama (perusahaan) ke swasta/instansi
            if (!u.accountType || u.accountType === 'perusahaan') {
                if (isAdmin(u) || isGovernmentAuthority(u.name)) {
                    u.accountType = 'instansi'; u.document = u.document || "Auto-Verified Legacy";
                } else if (/^(PT|CV|UD)\b/i.test(u.name)) {
                    u.accountType = 'swasta'; u.document = u.document || "Auto-Verified Legacy";
                } else if (!u.accountType) { 
                    u.accountType = 'pribadi'; 
                }
                dataBerubah = true;
            }

            let correctLvl = getInstansiLevel(u.name, u.address);
            if ((u.accountType === 'instansi' || u.accountType === 'perusahaan') && getDetailedAccountType(u) === 'pemerintah' && u.instansiLevel !== correctLvl) {
                u.instansiLevel = correctLvl; dataBerubah = true;
            }
        });
        if (dataBerubah) localStorage.setItem('users', JSON.stringify(parsedUsers));
    }
    if (!localStorage.getItem('gov_requests')) localStorage.setItem('gov_requests', JSON.stringify([]));
    
    applyEconomicStimulus();
}

// =========================================================
// 1.5 MESIN STIMULUS EKONOMI (1 MILIAR / JAM)
// =========================================================
function applyEconomicStimulus() {
    let lastUpdate = localStorage.getItem('last_stimulus_time');
    let now = Date.now();
    
    if (!lastUpdate) {
        localStorage.setItem('last_stimulus_time', now);
        return;
    }
    
    let timeDiff = now - parseInt(lastUpdate);
    let hoursPassed = Math.floor(timeDiff / (1000 * 60 * 60)); 
    
    if (hoursPassed > 0) {
        let users = getDB('users');
        let kemenkeuIdx = users.findIndex(u => u.name.toUpperCase().includes("KEMENTERIAN KEUANGAN"));
        
        if (kemenkeuIdx !== -1) {
            let stimulusAmount = hoursPassed * 1000000000; 
            users[kemenkeuIdx].balance += stimulusAmount;
            users[kemenkeuIdx].history.push({
                date: new Date().toLocaleString(),
                type: 'Stimulus Negara',
                desc: `Suntikan APBN (${hoursPassed} Jam)`,
                amount: stimulusAmount
            });
            saveDB('users', users);
        }
        
        let timeToKeep = timeDiff % (1000 * 60 * 60);
        localStorage.setItem('last_stimulus_time', now - timeToKeep);
    }
}

initDB();

// =========================================================
// 2. UTULITAS JENDELA ALERT
// =========================================================
function cAlert(msg, type = "info", onConfirm = null) {
    document.getElementById('alert-msg').innerText = msg;
    const btnContainer = document.getElementById('alert-buttons');
    if (type === "info") {
        btnContainer.innerHTML = `<button class="btn btn-primary" onclick="closeCAlert()">Mengerti</button>`;
    } else if (type === "confirm") {
        window.tempConfirmCb = onConfirm;
        btnContainer.innerHTML = `
            <button class="btn btn-secondary" onclick="closeCAlert()">Batalkan</button>
            <button class="btn btn-danger" onclick="executeCAlert()">Lanjutkan Prosedur</button>`;
    } else if (type === "prompt") {
        window.tempConfirmCb = onConfirm;
        btnContainer.innerHTML = `
            <input type="password" id="prompt-input" class="form-control" placeholder="Ketik PIN Konfirmasi" style="margin-bottom:12px;">
            <div style="display:flex; gap:10px; width:100%;">
                <button class="btn btn-secondary" style="flex:1;" onclick="closeCAlert()">Batal</button>
                <button class="btn btn-success" style="flex:1;" onclick="executeCPrompt()">Otorisasi</button>
            </div>`;
    }
    document.getElementById('custom-alert').style.display = 'flex';
}
function closeCAlert() { document.getElementById('custom-alert').style.display = 'none'; }
function executeCAlert() { closeCAlert(); if (window.tempConfirmCb) window.tempConfirmCb(); }
function executeCPrompt() { const val = document.getElementById('prompt-input').value; closeCAlert(); if (window.tempConfirmCb) window.tempConfirmCb(val); }

function getDB(key) { return JSON.parse(localStorage.getItem(key)); }
function saveDB(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
function formatRupiah(angka) { return 'Rp ' + parseInt(angka).toLocaleString('id-ID'); }
function getCurrentUser() { return JSON.parse(sessionStorage.getItem('currentUser')); }
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function toggleView() {
    const l = document.getElementById('login-section'); const r = document.getElementById('register-section');
    l.style.display = l.style.display === 'none' ? 'block' : 'none'; r.style.display = r.style.display === 'none' ? 'block' : 'none';
}
function checkRegType() {
    const type = document.getElementById('reg-type').value;
    // Tampilkan upload dokumen jika Swasta atau Instansi
    document.getElementById('doc-upload-group').style.display = (type === 'swasta' || type === 'instansi') ? 'block' : 'none';
}

// =========================================================
// 3. REGISTRASI
// =========================================================
function register() {
    const type = document.getElementById('reg-type').value;
    const name = document.getElementById('reg-name').value;
    const address = document.getElementById('reg-address').value;
    const dob = document.getElementById('reg-dob').value;
    const email = document.getElementById('reg-email').value;
    const pin = document.getElementById('reg-pin').value;
    const doc = document.getElementById('reg-doc').files[0];

    if (!name || !address || !dob || !email || !pin) return cAlert('Gagal! Pastikan Nama, Alamat, Tanggal, Email, dan PIN telah diisi lengkap!');
    if ((type === 'swasta' || type === 'instansi') && !doc) return cAlert('Akses Ditolak! Entitas Non-Pribadi wajib melampirkan berkas legalitas hukum!');
    if (pin.length < 6 || isNaN(pin)) return cAlert('DITOLAK! PIN Transaksi wajib berupa 6 digit angka numerik murni.');
    
    let users = getDB('users');
    if (users.find(u => u.email === email)) return cAlert('Alamat email tersebut telah terdaftar!');

    const newAccNumber = dob.replace(/-/g, "") + String(users.length + 1).padStart(3, '0');
    users.push({ 
        accountNumber: newAccNumber, name, address, dob, email, pin, balance: 0, history: [], bills: [],
        accountType: type, instansiLevel: getInstansiLevel(name, address), document: doc ? doc.name : null
    });
    
    saveDB('users', users); cAlert(`Pembukaan Rekening Sukses!\nNo Rekening Anda: ${newAccNumber}`); toggleView();
}

function login() {
    const email = document.getElementById('login-email').value;
    const pin = document.getElementById('login-pin').value;
    const user = getDB('users').find(u => u.email === email && u.pin === pin);
    if (user) { sessionStorage.setItem('currentUser', JSON.stringify(user)); window.location.href = 'beranda.html'; } 
    else cAlert('SALAH! Periksa kembali kombinasi Email & PIN!');
}
function logout() { sessionStorage.removeItem('currentUser'); window.location.href = 'index.html'; }

// =========================================================
// 4. DASBOR NASABAH
// =========================================================
function initDashboard() {
    applyEconomicStimulus(); 
    
    const user = getCurrentUser();
    if (!user) return window.location.href = 'index.html';

    const freshUser = getDB('users').find(u => u.email === user.email);
    sessionStorage.setItem('currentUser', JSON.stringify(freshUser));

    document.getElementById('user-greeting').innerText = `Selamat Datang, ${freshUser.name}`;
    document.getElementById('user-account-number').innerText = freshUser.accountNumber;
    document.getElementById('user-balance').innerText = formatRupiah(freshUser.balance);

    const emailContainer = document.getElementById('email-container');
    const addressContainer = document.getElementById('address-container');
    const detailedType = getDetailedAccountType(freshUser);

    if (detailedType !== "pribadi" || isAdmin(freshUser)) {
        if(emailContainer) emailContainer.style.display = 'inline-block';
        if(addressContainer) addressContainer.style.display = 'inline-block';
        const em = document.getElementById('user-account-email'); if(em) em.innerText = freshUser.email;
        const ad = document.getElementById('user-account-address'); if(ad) ad.innerText = freshUser.address || '-';
    } else { 
        if(emailContainer) emailContainer.style.display = 'none'; 
        if(addressContainer) addressContainer.style.display = 'none'; 
    }

    const badgeGov = document.getElementById('user-instansi-badge');
    if (badgeGov) {
        if (isGovernmentAuthority(freshUser.name)) {
            badgeGov.style.display = 'inline-block'; 
            badgeGov.innerText = freshUser.instansiLevel < 6 && freshUser.instansiLevel > 0 
                ? `OTORITAS PEMERINTAH - LVL ${freshUser.instansiLevel}` 
                : 'OTORITAS NEGARA / PUBLIK';
        } else if (detailedType === 'perusahaan_swasta') {
            badgeGov.style.display = 'inline-block'; badgeGov.innerText = 'PERUSAHAAN SWASTA';
        } else { badgeGov.style.display = 'none'; }
    }

    if (isAdmin(freshUser)) document.getElementById('btn-admin-shortcut').style.display = 'inline-block';

    const govKat = document.getElementById('gov-kategori');
    if(govKat) {
        if (detailedType === 'pribadi') {
            govKat.innerHTML = '<option value="Bantuan Medis Nasional">Bantuan Medis Nasional (Wajib Lampiran Faskes)</option>';
        } else {
            govKat.innerHTML = '<option value="Pembangunan Infrastruktur">Pembangunan Infrastruktur</option><option value="Dana BOS / Pendidikan">Dana BOS / Alokasi Pendidikan</option><option value="Kompensasi Kesehatan">Kompensasi Kesehatan</option><option value="Operasional Sektoral">Anggaran Operasional Sektoral</option><option value="Kebutuhan Darurat">Kebutuhan Darurat Lainnya</option>';
        }
        checkGovCategory(); 
    }

    renderHistory(freshUser.history); renderTagihan(freshUser.bills); renderGovUser();
}

function renderHistory(history) {
    const tbody = document.getElementById('history-table'); if(!tbody) return;
    tbody.innerHTML = [...history].reverse().map(h => `<tr><td>${h.date}</td><td>${h.type}</td><td>${h.desc}</td><td style="color: ${h.amount > 0 ? 'var(--success)' : 'var(--accent)'}"><strong>${h.amount > 0 ? '+' : ''}${formatRupiah(h.amount)}</strong></td></tr>`).join('');
}

function lookupName(inputId, previewId) {
    const acc = document.getElementById(inputId).value;
    const user = getDB('users').find(u => u.accountNumber === acc);
    document.getElementById(previewId).innerText = user ? `Tervalidasi: A/N ${user.name}` : "Rekening Sistem Tidak Terdaftar";
}

// =========================================================
// 5. TRANSAKSI STANDAR
// =========================================================
function ubahPinMandiri() {
    const pLama = document.getElementById('pin-lama').value; const pBaru = document.getElementById('pin-baru').value;
    let users = getDB('users'); let currentUser = getCurrentUser();
    if (pLama !== currentUser.pin) return cAlert("DITOLAK! PIN lama salah!");
    if (pBaru.length < 6 || isNaN(pBaru)) return cAlert("DITOLAK! Format PIN baru wajib 6 digit angka.");
    const idx = users.findIndex(u => u.email === currentUser.email);
    users[idx].pin = pBaru; saveDB('users', users); sessionStorage.setItem('currentUser', JSON.stringify(users[idx]));
    cAlert("Sistem Kriptografi: PIN Rahasia akun berhasil diubah!"); closeModal('modal-ubah-pin');
}

function processTopUp() {
    const amount = parseInt(document.getElementById('topup-amount').value); const pin = document.getElementById('topup-pin').value;
    let users = getDB('users'); let currentUser = getCurrentUser();
    if (pin !== currentUser.pin) return cAlert('DITOLAK! PIN Salah!');
    if (amount <= 0 || isNaN(amount)) return cAlert('DITOLAK! Nominal penempatan dana tidak valid!');
    const idx = users.findIndex(u => u.email === currentUser.email);
    users[idx].balance += amount; users[idx].history.push({ date: new Date().toLocaleString(), type: 'Top Up', desc: 'Penyetoran Kas Mandiri', amount: amount });
    saveDB('users', users); cAlert(`Penyetoran berhasil! Saldo dikreditkan ${formatRupiah(amount)}`); closeModal('modal-topup'); initDashboard();
}

function processTarik() {
    const amount = parseInt(document.getElementById('tarik-amount').value); const pin = document.getElementById('tarik-pin').value;
    let users = getDB('users'); let currentUser = getCurrentUser();
    if (amount <= 0 || isNaN(amount)) return cAlert('Gagal! nominal penarikan salah!');
    const senderIdx = users.findIndex(u => u.email === currentUser.email);
    const detailedType = getDetailedAccountType(currentUser);

    if (detailedType !== "pribadi" && !isAdmin(currentUser)) {
        const adminPusat = users.find(u => u.email === PRIMARY_COMPANY_EMAIL);
        if (pin !== adminPusat.pin) return cAlert('DITOLAK!Penarikan likuiditas korporasi/instansi wajib menyertakan Master PIN Otorisasi Pusat.');
    } else {
        if (pin !== currentUser.pin) return cAlert('DITOLAK!PIN Penarikan Salah!');
    }

    if (users[senderIdx].balance < amount) return cAlert('Kliring Gagal: Likuiditas saldo rekening tidak mencukupi!');
    users[senderIdx].balance -= amount; users[senderIdx].history.push({ date: new Date().toLocaleString(), type: 'Tarik', desc: 'Penarikan Tunai', amount: -amount });
    saveDB('users', users); cAlert('Penarikan tunai  sukses!'); closeModal('modal-tarik'); initDashboard();
}

function processTransfer() {
    const targetAcc = document.getElementById('tf-target').value;
    const amount = parseInt(document.getElementById('tf-amount').value);
    const pin = document.getElementById('tf-pin').value;
    let users = getDB('users'); let currentUser = getCurrentUser();
    if (pin !== currentUser.pin) return cAlert('GAGAL! PIN Otorisasi Salah!');
    if (targetAcc === currentUser.accountNumber) return cAlert('DITOLAK! Tidak dapat melakukan transfer ke rekening sendiri.');
    
    const senderIdx = users.findIndex(u => u.email === currentUser.email);
    const targetIdx = users.findIndex(u => u.accountNumber === targetAcc);
    const companyIdx = users.findIndex(u => u.email === PRIMARY_COMPANY_EMAIL);

    if (targetIdx === -1) return cAlert('GAGAL!Rekening entitas tujuan tidak diketemukan dalam interkoneksi bank.');
    cAlert(`Prosedur Transfer Interkoneksi Core:\n\nTujuan: ${users[targetIdx].name}\nNominal: ${formatRupiah(amount)}\n\nLanjutkan transaksi?`, "confirm", () => {
        const fee = (isAdmin(currentUser) || getDetailedAccountType(currentUser) !== 'pribadi') ? 0 : ADMIN_FEE;
        if (users[senderIdx].balance < (amount + fee)) return cAlert(`GAGAL! Saldo tidak mencukupi batas  (Ditambah beban jasa admin: ${formatRupiah(amount + fee)})`);

        users[senderIdx].balance -= (amount + fee);
        users[senderIdx].history.push({ date: new Date().toLocaleString(), type: 'Transfer Out', desc: `keluar ke ${users[targetIdx].name}`, amount: -amount });
        if (fee > 0) { users[senderIdx].history.push({ date: new Date().toLocaleString(), type: 'Biaya Jasa', desc: `Administrasi`, amount: -fee }); users[companyIdx].balance += fee; }
        
        users[targetIdx].balance += amount;
        users[targetIdx].history.push({ date: new Date().toLocaleString(), type: 'Transfer In', desc: `masuk dari  ${currentUser.name}`, amount: amount });
        saveDB('users', users); cAlert(`Sukses Terkirim!`); closeModal('modal-transfer'); initDashboard();
    });
}

function processRequest() {
    const targetAcc = document.getElementById('req-target').value; const amount = parseInt(document.getElementById('req-amount').value); const reason = document.getElementById('req-reason').value;
    let users = getDB('users'); let currentUser = getCurrentUser();
    if (targetAcc === currentUser.accountNumber) return cAlert('DITOLAK! Tidak diperkenankan menagih akun internal!');
    const targetIdx = users.findIndex(u => u.accountNumber === targetAcc);
    if (targetIdx === -1) return cAlert('GAGAL!Rekening tertagih salah!');
    cAlert(`Terbitkan nota tagihan digital senilai ${formatRupiah(amount)} kepada ${users[targetIdx].name}?`, "confirm", () => {
        users[targetIdx].bills.push({ id: Date.now(), fromAccount: currentUser.accountNumber, fromName: currentUser.name, amount: amount, reason: reason });
        saveDB('users', users); cAlert('Nota Invoice Masuk digital sukses!'); closeModal('modal-minta');
    });
}

function renderTagihan(bills) {
    const tbody = document.getElementById('tagihan-table'); const badge = document.getElementById('badge-tagihan');
    if(badge) badge.innerText = bills.length > 0 ? `(${bills.length})` : ''; if(!tbody) return;
    tbody.innerHTML = bills.map(b => `<tr><td>${b.fromName}</td><td>${b.reason}</td><td><strong>${formatRupiah(b.amount)}</strong></td>
        <td><button class="btn btn-danger" style="padding:6px;" onclick="bayarTagihan(${b.id})">Eksekusi Pelunasan</button></td></tr>`).join('');
}

function bayarTagihan(billId) {
    cAlert("Konfirmasi Pembayaran, Masukkan PIN Anda:", "prompt", (pin) => {
        let users = getDB('users'); let currentUser = getCurrentUser();
        if (pin !== currentUser.pin) return cAlert('Otorisasi Ditolak: Autentikasi PIN Salah!');
        const senderIdx = users.findIndex(u => u.email === currentUser.email);
        const billIdx = users[senderIdx].bills.findIndex(b => b.id === billId); const bill = users[senderIdx].bills[billIdx];
        const targetIdx = users.findIndex(u => u.accountNumber === bill.fromAccount);
        
        const fee = (isAdmin(currentUser) || getDetailedAccountType(currentUser) !== 'pribadi') ? 0 : ADMIN_FEE;
        if (users[senderIdx].balance < (bill.amount + fee)) return cAlert('Debit Gagal: Saldo kas akun tidak mencukupi kewajiban penagihan!');

        users[senderIdx].balance -= (bill.amount + fee); users[senderIdx].history.push({ date: new Date().toLocaleString(), type: 'Bayar Tagihan', desc: `Pelunasan Invoice kepada ${bill.fromName}`, amount: -bill.amount });
        users[targetIdx].balance += bill.amount; users[targetIdx].history.push({ date: new Date().toLocaleString(), type: 'Invoice Cair', desc: `Pencairan Tagihan oleh ${currentUser.name}`, amount: bill.amount });
        
        users[senderIdx].bills.splice(billIdx, 1); saveDB('users', users); cAlert('Nota Kewajiban Tagihan Telah Dilunasi!'); initDashboard(); closeModal('modal-tagihan');
    });
}

// =========================================================
// 6. MODULE CORE MANAJEMEN HIBAH (GOV SYSTEM)
// =========================================================
function checkGovCategory() {
    const cat = document.getElementById('gov-kategori').value; 
    const hf = document.getElementById('health-fields');
    if(hf) hf.style.display = (cat.includes('Kesehatan') || cat.includes('Medis')) ? 'block' : 'none';
}

function submitGovRequest() {
    const targetAcc = document.getElementById('gov-target').value; 
    const amount = parseInt(document.getElementById('gov-amount').value);
    const category = document.getElementById('gov-kategori').value; 
    const reason = document.getElementById('gov-reason').value;
    
    let users = getDB('users'); 
    let currentUser = getCurrentUser(); 
    const myType = getDetailedAccountType(currentUser);
    
    const isMedis = category.includes('Kesehatan') || category.includes('Medis');
    
    // PEMBLOKIRAN SWASTA MURNI
    if (myType === 'perusahaan_swasta') {
        return cAlert('PENGAJUAN GAGAL! Perusahaan Swasta murni tidak memiliki hak untuk meminta anggaran dari negara!');
    }

    // Akun Pribadi HANYA boleh minta bantuan medis
    if (myType === 'pribadi' && !isMedis) {
        return cAlert('PENGAJUAN GAGAL! Akun Perorangan hanya dapat mengajukan Kompensasi Medis.');
    }
    
    const targetIdx = users.findIndex(u => u.accountNumber === targetAcc);
    if (targetIdx === -1) return cAlert('PENGAJUAN DITOLAK! Rekening tujuan anggaran salah atau tidak ditemukan!');

    // Target HARUS Otoritas Pemerintah / BUMN
    if (users[targetIdx].instansiLevel === 0 && !isGovernmentAuthority(users[targetIdx].name)) {
        return cAlert('GAGAL! Rekening tujuan bukanlembaga yang berwenang menyalurkan anggaran subsidi!');
    }

    let extraHealthData = "";
    if (isMedis) {
        const faskes = document.getElementById('gov-faskes').value; 
        const tgl = document.getElementById('gov-tanggal').value; 
        const antri = document.getElementById('gov-antrian').value;
        if (!faskes || !tgl || !antri) return cAlert('VALIDASI GAGAL! Data Rekam Medis Faskes Rujukan, Tanggal, dan Nomor Antrian Wajib Tercantum!');
        extraHealthData = ` [Faskes: ${faskes} | Tgl: ${tgl} | Antri: ${antri}]`;
    }

    const fullReason = `[${category}] ${reason}${extraHealthData}`; 
    let reqs = getDB('gov_requests');
    
    reqs.push({ 
        id: Date.now(), 
        fromAcc: currentUser.accountNumber, 
        fromName: currentUser.name, 
        targetAcc: targetAcc, 
        targetName: users[targetIdx].name, 
        amount: amount, 
        reason: fullReason, 
        status: 'Menunggu Persetujuan', 
        pin: null 
    });
    
    saveDB('gov_requests', reqs); 
    cAlert('Pengajuan Berhasil!'); 
    initDashboard();
}

function renderGovUser() {
    const tbody = document.getElementById('gov-user-table'); if (!tbody) return;
    const reqs = getDB('gov_requests').filter(r => r.fromAcc === getCurrentUser().accountNumber);
    
    tbody.innerHTML = reqs.map(r => `
        <tr>
            <td>${r.targetName}</td>
            <td><span style="font-size:12px;">${r.reason}</span></td>
            <td>
                <span class="badge-instansi" style="background:${r.status==='Disetujui'?'var(--success)':'#d97706'}; color:#fff; border:none; padding: 6px 10px; font-size: 12px;">
                    ${r.status === 'Disetujui' ? `DISETUJUI (PIN: ${r.pin})` : r.status}
                </span>
            </td>
            <td>
                ${r.status === 'Disetujui' ? `<button class="btn btn-success" style="padding:6px 10px; font-size:12px;" onclick="claimGov(${r.id})">Cairkan Anggaran</button>` : '-'}
            </td>
        </tr>
    `).join('');
}

function claimGov(reqId) {
    cAlert("Masukkan 6 Digit KODE PIN PENCAIRAN ANGGARAN yang tertera pada Status:", "prompt", (pin) => {
        let reqs = getDB('gov_requests'); let users = getDB('users');
        let rIdx = reqs.findIndex(r => r.id === reqId);
        if (reqs[rIdx].pin !== pin) return cAlert('DITOLAK! Kode PIN Alokasi Pencairan Anggaran Salah/Kadaluarsa!');

        let uIdx = users.findIndex(u => u.accountNumber === reqs[rIdx].fromAcc); let gIdx = users.findIndex(u => u.accountNumber === reqs[rIdx].targetAcc);
        
        users[uIdx].balance += reqs[rIdx].amount; 
        users[uIdx].history.push({ date: new Date().toLocaleString(), type: 'Cair Anggaran', desc: ` dari ${reqs[rIdx].targetName}`, amount: reqs[rIdx].amount });
        
        users[gIdx].balance -= reqs[rIdx].amount; 
        users[gIdx].history.push({ date: new Date().toLocaleString(), type: 'Distribusi Anggaran', desc: `Pencairan ke ${reqs[rIdx].fromName}`, amount: -reqs[rIdx].amount });

        reqs.splice(rIdx, 1); saveDB('users', users); saveDB('gov_requests', reqs);
        cAlert('berhasil dicairkan ke saldo akun Anda!'); initDashboard();
    });
}

// =========================================================
// 7. PANEL ADMIN & TAB SEGMENTED CONTROL
// =========================================================
function filterGov(level, btnElement) {
    currentGovFilter = level;
    document.querySelectorAll('.btn-filter').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active'); initAdmin(); 
}

function switchTab(tabId, btnElement) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    const selectedTab = document.getElementById(tabId);
    if (selectedTab) selectedTab.classList.add('active');
    if (btnElement) btnElement.classList.add('active');
}

function initAdmin() {
    applyEconomicStimulus(); 
    
    const user = getCurrentUser();
    if (!user || !isAdmin(user)) return window.location.href = 'beranda.html';
    const users = getDB('users');
    
    const tablePribadi = document.getElementById('admin-pribadi-table');
    if(tablePribadi) {
        tablePribadi.innerHTML = users.filter(u => getDetailedAccountType(u) === 'pribadi').map(u => `
            <tr><td>${u.accountNumber}</td><td>${u.name}</td><td><span style="font-size:12px; color:var(--text-muted);">${u.address||'-'}</span></td><td>${u.email}</td><td><strong>${formatRupiah(u.balance)}</strong></td>
                <td><div style="display:flex; gap:4px;"><button class="btn btn-warning" onclick="resetUserPin('${u.accountNumber}')">PIN</button><button class="btn btn-danger" onclick="deleteUser('${u.accountNumber}')">Hapus</button></div></td></tr>`).join('');
    }

    const tableSwasta = document.getElementById('admin-swasta-table');
    if(tableSwasta) {
        tableSwasta.innerHTML = users.filter(u => getDetailedAccountType(u) === 'perusahaan_swasta').map(u => `
            <tr><td>${u.accountNumber}</td><td>${u.name}</td><td><span style="font-size:12px; color:var(--text-muted);">${u.address||'-'}</span></td><td>${u.email}</td><td><strong style="color:var(--accent);">${u.pin}</strong></td><td><strong>${formatRupiah(u.balance)}</strong></td>
                <td><div style="display:flex; gap:4px;"><button class="btn btn-warning" onclick="resetUserPin('${u.accountNumber}')">PIN</button><button class="btn btn-danger" onclick="deleteUser('${u.accountNumber}')">Hapus</button></div></td></tr>`).join('');
    }

    const tableBumn = document.getElementById('admin-bumn-table');
    if(tableBumn) {
        tableBumn.innerHTML = users.filter(u => getDetailedAccountType(u) === 'bumn').map(u => `
            <tr><td>${u.accountNumber}</td><td>${u.name}</td><td><span style="font-size:12px; color:var(--text-muted);">${u.address||'-'}</span></td><td>${u.email}</td><td><strong style="color:var(--accent);">${u.pin}</strong></td><td><strong>${formatRupiah(u.balance)}</strong></td>
                <td><div style="display:flex; gap:4px;"><button class="btn btn-warning" onclick="resetUserPin('${u.accountNumber}')">PIN</button><button class="btn btn-danger" onclick="deleteUser('${u.accountNumber}')">Hapus</button></div></td></tr>`).join('');
    }

    const tableGovAccounts = document.getElementById('admin-gov-accounts-table');
    if(tableGovAccounts) {
        let govUsers = users.filter(u => getDetailedAccountType(u) === 'pemerintah');
        if (currentGovFilter !== 'ALL') { govUsers = govUsers.filter(u => u.instansiLevel === currentGovFilter); }
        tableGovAccounts.innerHTML = govUsers.map(u => `
            <tr><td>${u.accountNumber}</td><td>${u.name}</td><td><span style="font-size:12px; color:var(--text-muted);">${u.address||'-'}</span></td>
                <td><span class="badge-instansi" style="border:none; background:var(--secondary); color:#fff;">LVL-${u.instansiLevel}</span></td><td>${u.email}</td><td><strong style="color:var(--accent);">${u.pin}</strong></td><td><strong>${formatRupiah(u.balance)}</strong></td>
                <td><div style="display:flex; gap:4px;"><button class="btn btn-warning" onclick="resetUserPin('${u.accountNumber}')">PIN</button><button class="btn btn-danger" onclick="deleteUser('${u.accountNumber}')">Hapus</button></div></td></tr>`).join('');
    }

    const tablePend = document.getElementById('admin-pendidikan-table');
    if(tablePend) {
        tablePend.innerHTML = users.filter(u => getDetailedAccountType(u) === 'pendidikan').map(u => `
            <tr><td>${u.accountNumber}</td><td>${u.name}</td><td><span style="font-size:12px; color:var(--text-muted);">${u.address||'-'}</span></td><td>${u.email}</td><td><strong style="color:var(--accent);">${u.pin}</strong></td><td><strong>${formatRupiah(u.balance)}</strong></td>
                <td><div style="display:flex; gap:4px;"><button class="btn btn-warning" onclick="resetUserPin('${u.accountNumber}')">PIN</button><button class="btn btn-danger" onclick="deleteUser('${u.accountNumber}')">Hapus</button></div></td></tr>`).join('');
    }
    
    const tableGlobal = document.getElementById('admin-global-table');
    if(tableGlobal) {
        let allTx = [];
        users.forEach(u => { if(u.history) { u.history.forEach(h => { allTx.push({ ...h, acc: u.accountNumber, name: u.name }); }); } });
        allTx.sort((a,b) => new Date(b.date) - new Date(a.date));
        tableGlobal.innerHTML = allTx.map(t => `<tr><td>${t.date}</td><td>${t.acc}</td><td>${t.name}</td><td>${t.type}</td><td><span style="font-size:12px;">${t.desc}</span></td><td style="color:${t.amount>0?'var(--success)':'var(--accent)'}"><strong>${t.amount}</strong></td></tr>`).join('');
    }

    const tableGov = document.getElementById('admin-gov-table');
    if(tableGov) {
        const reqs = getDB('gov_requests');
        tableGov.innerHTML = reqs.map(r => `<tr><td>${r.fromName}</td><td><strong>${formatRupiah(r.amount)}</strong></td><td><span style="font-size:12px;">${r.reason}</span></td><td><span class="badge-instansi" style="background:${r.status==='Disetujui'?'var(--success)':'#d97706'}; color:#fff; border:none;">${r.status === 'Disetujui' ? `VALID: PIN ${r.pin}` : r.status}</span></td>
            <td>${r.status === 'Menunggu Persetujuan' ? `<button class="btn btn-success" onclick="approveGov(${r.id})">Terbitkan PIN</button>` : '<span style="font-size:12px; color:var(--text-muted);">Selesai</span>'}</td></tr>`).join('');
    }
}

function deleteUser(accNum) {
    let users = getDB('users'); const userIdx = users.findIndex(u => u.accountNumber === accNum);
    if (userIdx === -1) return cAlert("ERROR Akun tidak diketemukan!");
    if (users[userIdx].email === PRIMARY_COMPANY_EMAIL) return cAlert("AKSES DITOLAK! AKUN TIDAK DAPAT DIHAPUS");
    
    cAlert(`HAPUS AKUN\nApakah Anda yakin akan menghapus permanen akun ${users[userIdx].name}?`, "confirm", () => {
        users.splice(userIdx, 1); saveDB('users', users);
        let reqs = getDB('gov_requests'); reqs = reqs.filter(r => r.fromAcc !== accNum && r.targetAcc !== accNum);
        saveDB('gov_requests', reqs); cAlert("Akun  teklah dihapus permanen!"); initAdmin();
    });
}

function deleteAllUsers() {
    cAlert("APAKAH ANDA YAKIN MENGHAPUS SEMUA AKUN!\nApakah Anda benar-benar yakin ingin memusnahkan seluruh akun  di database?\n\nTindakan ini ireversibel, seluruh saldo, transaksi, entitas akan hancur dan HANYA menyisakan Akun Induk Korporasi Utama Bank Merdeka.", "confirm", () => {
        let users = getDB('users'); users = users.filter(u => u.email === PRIMARY_COMPANY_EMAIL);
        saveDB('users', users); saveDB('gov_requests', []); cAlert("PENGHAPUSAN BERHASIL Seluruh database dibersihkan kecuali Master Induk Bank!"); initAdmin();
    });
}

function resetUserPin(accNum) {
    cAlert(`Masukkan Kode PIN Akses Baru untuk Nasabah (${accNum}):`, "prompt", (newPin) => {
        if (!newPin || newPin.length < 6 || isNaN(newPin)) return cAlert('GAGAL Format PIN intervensi wajib 6 digit angka numerik.');
        let users = getDB('users'); const idx = users.findIndex(u => u.accountNumber === accNum);
        users[idx].pin = newPin; saveDB('users', users); cAlert('PIN BERHASIL DIPERBARUI'); initAdmin();
    });
}

function approveGov(reqId) {
    const pinCair = Math.floor(100000 + Math.random() * 900000).toString();
    let reqs = getDB('gov_requests'); let idx = reqs.findIndex(r => r.id === reqId);
    reqs[idx].status = 'Disetujui'; reqs[idx].pin = pinCair; saveDB('gov_requests', reqs);
    cAlert(`PENGAJUAN DISETUJUI!\nBerikan kode PIN pencairan ini kepada Pengaju:\n\nKODE SUBSIDI: ${pinCair}`); initAdmin();
}
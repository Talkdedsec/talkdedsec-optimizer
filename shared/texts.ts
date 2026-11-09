// [title, description] per tweak, per language. Ids match shared/tweaks.json; a test checks none is missing.
export const TEXT: Record<string, { tr: [string, string]; en: [string, string] }> = {
  // performance
  "perf.win32-priority-separation": {
    tr: ["Öndeki uygulamaya öncelik", "Kullandığın pencere, arka plandaki işlere göre daha uzun ve sık işlemci süresi alır."],
    en: ["Prioritise the foreground app", "The window you are using gets longer and more frequent CPU time than background work."],
  },
  "perf.disable-paging-executive": {
    tr: ["Çekirdeği bellekte tut", "Windows çekirdeği ve sürücüleri diske yazılmaz; RAM'i bol sistemlerde takılmaları azaltır."],
    en: ["Keep the kernel in RAM", "The Windows kernel and drivers are never paged to disk; fewer stutters when RAM is plentiful."],
  },
  "perf.svchost-split-threshold": {
    tr: ["Servis süreçlerini birleştir", "Servisleri daha az sayıda svchost sürecinde toplar; süreç sayısı ve bellek yükü düşer."],
    en: ["Group service processes", "Packs services into fewer svchost processes, lowering process count and memory overhead."],
  },
  "perf.system-responsiveness": {
    tr: ["Multimedya işlemci payını geri al", "Windows'un arka plan işleri için ayırdığı %20 işlemci payını ön plandaki işe verir."],
    en: ["Reclaim the multimedia CPU reserve", "Gives foreground work the 20% of CPU that Windows holds back for background tasks."],
  },
  "perf.games-task-priority": {
    tr: ["Oyun görev önceliğini yükselt", "Oyun olarak işaretlenen süreçler için işlemci, ekran kartı ve disk önceliğini artırır."],
    en: ["Raise game task priority", "Raises CPU, GPU and disk priority for processes scheduled as games."],
  },
  "perf.disable-power-throttling": {
    tr: ["Güç kısıtlamasını kapat", "Windows'un arka plandaki uygulamaları yavaşlatmasını engeller. Masaüstü içindir, pil ömrünü kısaltır."],
    en: ["Disable power throttling", "Stops Windows slowing down background apps. Meant for desktops; it costs battery life."],
  },
  "perf.enable-hags": {
    tr: ["Donanım hızlandırmalı GPU zamanlaması", "Kare zamanlamasını ekran kartına bırakır; gecikmeyi azaltabilir. Sürücü desteği gerekir."],
    en: ["Hardware-accelerated GPU scheduling", "Lets the graphics card schedule its own frames, which can cut latency. Needs driver support."],
  },
  "perf.startup-delay": {
    tr: ["Başlangıç gecikmesini kaldır", "Oturum açınca başlangıç uygulamalarının bekletildiği süreyi sıfırlar."],
    en: ["Remove the startup delay", "Drops the wait Windows adds before launching startup apps after sign-in."],
  },
  "perf.menu-show-delay": {
    tr: ["Menüleri anında aç", "Menülerin açılmadan önceki 400 ms'lik beklemesini kaldırır."],
    en: ["Open menus instantly", "Removes the 400 ms pause before a menu appears."],
  },
  "perf.app-timeouts": {
    tr: ["Yanıt vermeyen uygulamaları hızlı kapat", "Donan uygulamalar için bekleme süresini kısaltır ve kapanışta otomatik sonlandırır. Kaydedilmemiş iş kaybolabilir."],
    en: ["Close hung apps sooner", "Shortens the wait for frozen apps and ends them automatically at shutdown. Unsaved work can be lost."],
  },
  "perf.wait-to-kill-service": {
    tr: ["Servisleri hızlı durdur", "Kapanışta servislerin durması için beklenen süreyi 2 saniyeye indirir."],
    en: ["Stop services faster", "Cuts the time Windows waits for services to stop at shutdown to 2 seconds."],
  },

  // memory
  "memory.disable-compression": {
    tr: ["Bellek sıkıştırmayı kapat", "RAM'i bol sistemlerde sıkıştırmaya harcanan işlemci süresini geri kazandırır."],
    en: ["Disable memory compression", "Recovers the CPU time spent compressing memory on machines with plenty of RAM."],
  },
  "memory.clear-pagefile-off": {
    tr: ["Kapanışta sayfa dosyasını silme", "Sayfa dosyasının her kapanışta sıfırlanmasını engeller; kapanış hızlanır."],
    en: ["Do not wipe the page file at shutdown", "Stops the page file being zeroed on every shutdown, so shutdown is quicker."],
  },
  "memory.pagefile-fixed": {
    tr: ["Sayfa dosyasını sabitle", "Sayfa dosyasını RAM'in 1,5 katında sabit tutar; büyüyüp küçülürken oluşan parçalanmayı önler."],
    en: ["Fix the page file size", "Pins the page file at 1.5× RAM so it stops fragmenting as it grows and shrinks."],
  },

  // power
  "power.high-performance-plan": {
    tr: ["Yüksek performans güç planı", "İşlemcinin hız düşürmediği güç planına geçer. Geri alındığında Dengeli plana döner."],
    en: ["High performance power plan", "Switches to the plan that does not clock the CPU down. Undo returns to Balanced."],
  },
  "power.disable-core-parking": {
    tr: ["Çekirdek park etmeyi kapat", "Tüm işlemci çekirdeklerini uyanık tutar; ani yüklerde gecikme olmaz."],
    en: ["Disable core parking", "Keeps every CPU core awake so sudden load does not wait for a core to wake."],
  },
  "power.min-processor-state": {
    tr: ["İşlemciyi tam hızda tut", "Prizdeyken en düşük işlemci durumunu %100 yapar. Isı ve tüketim artar."],
    en: ["Hold the CPU at full speed", "Sets the minimum processor state to 100% on AC. Runs hotter and draws more power."],
  },
  "power.usb-selective-suspend": {
    tr: ["USB uyku modunu kapat", "USB aygıtlarının güç tasarrufu için kapatılmasını engeller; fare ve klavye kopmaları azalır."],
    en: ["Disable USB selective suspend", "Stops USB devices being powered down to save energy; fewer mouse and keyboard dropouts."],
  },
  "power.pcie-link-state": {
    tr: ["PCIe güç tasarrufunu kapat", "Ekran kartı ve NVMe bağlantılarının düşük güç durumuna geçmesini engeller."],
    en: ["Disable PCIe link power saving", "Keeps graphics card and NVMe links out of their low-power states."],
  },
  "power.disk-never-sleep": {
    tr: ["Diskleri uyutma", "Prizdeyken disklerin durdurulmasını kapatır; uyanma beklemesi olmaz."],
    en: ["Never spin down drives", "Turns off drive sleep on AC power, so there is no spin-up wait."],
  },
  "power.disable-adaptive-brightness": {
    tr: ["Uyarlanır parlaklığı kapat", "Ekran parlaklığının ortam ışığına göre kendiliğinden değişmesini durdurur."],
    en: ["Disable adaptive brightness", "Stops the screen changing brightness on its own with ambient light."],
  },
  "power.fast-startup-off": {
    tr: ["Hızlı Başlatma'yı kapat", "Her kapanışta sistemi gerçekten kapatır; sürücü ve güncelleme sorunlarını önler."],
    en: ["Disable Fast Startup", "Makes every shutdown a real one, avoiding stale drivers and stuck updates."],
  },

  // services
  "svc.sysmain": {
    tr: ["SysMain (Superfetch)", "Uygulamaları belleğe önceden yükleyen servis. SSD'de kazancı yok, disk ve RAM kullanır."],
    en: ["SysMain (Superfetch)", "Preloads apps into memory. No gain on an SSD, and it uses disk and RAM."],
  },
  "svc.wsearch": {
    tr: ["Windows Search dizinleyici", "Arka plan dizinlemeyi durdurur. Başlat menüsü ve Gezgin'de arama yavaşlar."],
    en: ["Windows Search indexer", "Stops background indexing. Search in Start and Explorer becomes slower."],
  },
  "svc.telemetry": {
    tr: ["Telemetri servisleri", "Kullanım ve tanılama verisini Microsoft'a gönderen servisleri kapatır."],
    en: ["Telemetry services", "Turns off the services that send usage and diagnostic data to Microsoft."],
  },
  "svc.error-reporting": {
    tr: ["Hata bildirimi", "Çökme raporlarının toplanıp gönderilmesini durdurur."],
    en: ["Error reporting", "Stops crash reports being collected and sent."],
  },
  "svc.diagnostic-policy": {
    tr: ["Tanılama servisleri", "Sorun algılama ve giderme servislerini kapatır. Windows sorun gidericileri çalışmaz."],
    en: ["Diagnostic services", "Turns off problem detection and troubleshooting services. Windows troubleshooters stop working."],
  },
  "svc.print-spooler": {
    tr: ["Yazdırma biriktiricisi", "Yazıcı kullanmıyorsan gereksiz; kapatmak bilinen bir saldırı yüzeyini de kaldırır."],
    en: ["Print spooler", "Unneeded without a printer; turning it off also removes a known attack surface."],
  },
  "svc.fax": {
    tr: ["Faks", "Faks gönderip alma servisi."],
    en: ["Fax", "The service for sending and receiving faxes."],
  },
  "svc.remote-registry": {
    tr: ["Uzak kayıt defteri", "Ağdaki başka bilgisayarların kayıt defterini değiştirebilmesini kapatır."],
    en: ["Remote Registry", "Stops other computers on the network editing this PC's registry."],
  },
  "svc.retail-demo": {
    tr: ["Mağaza demo modu", "Yalnızca mağazalardaki teşhir bilgisayarlarında kullanılan servis."],
    en: ["Retail demo", "A service used only on shop display machines."],
  },
  "svc.maps": {
    tr: ["Çevrimdışı haritalar", "İndirilmiş haritaları güncelleyen servis."],
    en: ["Offline maps", "The service that updates downloaded maps."],
  },
  "svc.xbox": {
    tr: ["Xbox servisleri", "Xbox oturum, kayıt ve ağ servislerini kapatır. Game Pass ve Xbox uygulaması çalışmaz."],
    en: ["Xbox services", "Turns off Xbox sign-in, save and networking services. Game Pass and the Xbox app stop working."],
  },
  "svc.parental-controls": {
    tr: ["Ebeveyn denetimleri", "Çocuk hesaplarını izleyen servis."],
    en: ["Parental controls", "The service that monitors child accounts."],
  },
  "svc.program-compatibility": {
    tr: ["Program uyumluluk yardımcısı", "Eski programları izleyip uyumluluk önerisi sunan servis."],
    en: ["Program Compatibility Assistant", "Watches older programs and suggests compatibility fixes."],
  },
  "svc.geolocation": {
    tr: ["Konum servisi", "Uygulamalara konum sağlayan servis. Harita ve hava durumu konumunu bulamaz."],
    en: ["Geolocation", "Provides location to apps. Maps and weather can no longer find where you are."],
  },
  "svc.phone": {
    tr: ["Telefon servisleri", "Telefon Bağlantısı ve çevirmeli bağlantı servislerini kapatır."],
    en: ["Phone services", "Turns off Phone Link and dial-up telephony services."],
  },
  "svc.bluetooth": {
    tr: ["Bluetooth servisleri", "Bu bilgisayarda çalışan bir Bluetooth aygıtı yokken gereksiz."],
    en: ["Bluetooth services", "Unneeded when this PC has no working Bluetooth radio."],
  },
  "svc.biometric": {
    tr: ["Biyometri servisi", "Parmak izi ve yüz tanımayı kapatır. Windows Hello ile giriş çalışmaz."],
    en: ["Biometric service", "Turns off fingerprint and face recognition. Windows Hello sign-in stops working."],
  },
  "svc.secondary-logon": {
    tr: ["İkincil oturum açma", "\"Farklı kullanıcı olarak çalıştır\" özelliğini kapatır."],
    en: ["Secondary Logon", "Turns off \"Run as different user\"."],
  },
  "svc.mobile-hotspot": {
    tr: ["Mobil etkin nokta", "Bilgisayarın internetini başka cihazlarla paylaşma servisi."],
    en: ["Mobile hotspot", "The service that shares this PC's internet with other devices."],
  },
  "svc.delivery-optimization": {
    tr: ["Teslim iyileştirme servisi", "Güncellemeleri başka bilgisayarlarla paylaşan servisi kapatır."],
    en: ["Delivery Optimization service", "Turns off the service that shares updates with other PCs."],
  },
  "svc.wmp-network": {
    tr: ["Media Player ağ paylaşımı", "Medya kitaplığını ağdaki cihazlarla paylaşan servis."],
    en: ["Media Player network sharing", "Shares the media library with devices on the network."],
  },
  "svc.insider": {
    tr: ["Windows Insider servisi", "Insider önizleme sürümlerini almıyorsan gereksiz."],
    en: ["Windows Insider service", "Unneeded unless you receive Insider preview builds."],
  },
  "svc.touch-keyboard": {
    tr: ["Dokunmatik klavye", "Dokunmatik klavye ve el yazısı paneli servisi. Emoji paneli de bundan etkilenebilir."],
    en: ["Touch keyboard", "The touch keyboard and handwriting service. The emoji panel can be affected too."],
  },
  "svc.work-folders": {
    tr: ["Çalışma klasörleri", "Kurumsal dosya eşitleme servisi."],
    en: ["Work Folders", "A corporate file sync service."],
  },
  "svc.payments-nfc": {
    tr: ["NFC ödeme servisi", "NFC ile ödeme ve güvenli öğe yönetimi servisi."],
    en: ["NFC payments", "The service for NFC payments and secure elements."],
  },
  "svc.netbios-helper": {
    tr: ["NetBIOS yardımcısı", "Eski NetBIOS ad çözümleme servisi. Çok eski ağ paylaşımları etkilenebilir."],
    en: ["NetBIOS helper", "Legacy NetBIOS name resolution. Very old network shares can be affected."],
  },
  "svc.ssdp-upnp": {
    tr: ["SSDP ve UPnP", "Ağdaki cihazları bulma servisleri. Bazı oyunların otomatik port açması ve medya cihazları çalışmayabilir."],
    en: ["SSDP and UPnP", "Network device discovery. Automatic port forwarding in some games and media devices can stop working."],
  },
  "svc.connected-devices": {
    tr: ["Bağlı cihazlar platformu", "Cihazlar arası paylaşım servisleri. Yakın Paylaşım ve bazı Ayarlar sayfaları etkilenir."],
    en: ["Connected Devices Platform", "Cross-device sharing services. Nearby Sharing and some Settings pages are affected."],
  },

  // gaming
  "game.disable-gamedvr": {
    tr: ["Game DVR arka plan kaydını kapat", "Oyunları arka planda sürekli kaydeden özelliği kapatır; kare hızı kaybı azalır."],
    en: ["Disable Game DVR background recording", "Turns off constant background capture of games, which costs frame rate."],
  },
  "game.disable-game-bar": {
    tr: ["Game Bar'ı kapat", "Win+G katmanını ve oyun açılışındaki ipuçlarını kapatır."],
    en: ["Disable the Game Bar", "Turns off the Win+G overlay and its tips when a game starts."],
  },
  "game.disable-fullscreen-optimizations": {
    tr: ["Gerçek tam ekranı zorla", "Tam ekran iyileştirmelerini kapatır; oyunlar özel tam ekran modunda çalışır."],
    en: ["Force true exclusive fullscreen", "Turns off fullscreen optimizations so games run in exclusive fullscreen."],
  },
  "game.enable-game-mode": {
    tr: ["Oyun Modu'nu aç", "Oyun sırasında güncelleme kurulumunu ve arka plan işlerini erteler."],
    en: ["Enable Game Mode", "Holds back update installs and background work while a game is running."],
  },
  "game.variable-refresh-rate": {
    tr: ["Pencereli oyun iyileştirmeleri", "Pencereli ve kenarlıksız oyunlarda daha düşük gecikmeli sunum modelini açar."],
    en: ["Optimizations for windowed games", "Enables the lower-latency presentation model for windowed and borderless games."],
  },
  "game.input-queue-size": {
    tr: ["Giriş arabelleklerini küçült", "Fare ve klavye veri kuyruğunu küçültür. Çok yüksek yoklama hızlı farelerde giriş kaçabilir."],
    en: ["Shrink input buffers", "Reduces the mouse and keyboard data queues. Very high polling-rate mice can drop input."],
  },

  // network
  "net.disable-nagle": {
    tr: ["Nagle algoritmasını kapat", "Küçük paketlerin bekletilmeden gönderilmesini sağlar; çevrim içi oyunlarda gecikmeyi azaltır."],
    en: ["Disable Nagle's algorithm", "Sends small packets without waiting to batch them; lowers latency in online games."],
  },
  "net.throttling-index": {
    tr: ["Ağ kısıtlamasını kaldır", "Medya oynatılırken ağ trafiğine uygulanan paket sınırını kaldırır."],
    en: ["Remove network throttling", "Lifts the packet limit Windows applies to network traffic while media is playing."],
  },
  "net.tcp-global": {
    tr: ["TCP yığınını ayarla", "Otomatik pencere ayarını ve RSS'i açar, ECN ile zaman damgalarını kapatır."],
    en: ["Tune the TCP stack", "Enables window auto-tuning and RSS; disables ECN and timestamps."],
  },
  "net.port-exhaustion": {
    tr: ["Port aralığını genişlet", "Giden bağlantı portlarını artırır ve kapanan bağlantıların bekleme süresini kısaltır."],
    en: ["Widen the port range", "Adds outgoing connection ports and shortens how long closed connections linger."],
  },
  "net.disable-llmnr": {
    tr: ["LLMNR'yi kapat", "Yerel ağda kimlik bilgisi çalmakta kullanılan eski ad çözümleme protokolünü kapatır."],
    en: ["Disable LLMNR", "Turns off a legacy name resolution protocol that is abused to steal credentials on local networks."],
  },
  "net.delivery-optimization-off": {
    tr: ["Güncelleme paylaşımını kapat", "İndirdiğin güncellemelerin internetteki başka bilgisayarlara yüklenmesini durdurur."],
    en: ["Stop sharing updates", "Stops updates you downloaded being uploaded to other PCs on the internet."],
  },
  "net.fast-dns": {
    tr: ["Hızlı DNS kullan", "Etkin bağdaştırıcıların DNS'ini 1.1.1.1 ve 8.8.8.8 yapar. Geri alınca otomatik DNS'e döner; elle girdiğin DNS silinir."],
    en: ["Use fast DNS", "Sets DNS on active adapters to 1.1.1.1 and 8.8.8.8. Undo returns to automatic DNS; a manual DNS entry is lost."],
  },
  "net.disable-lso": {
    tr: ["Large Send Offload'u kapat", "Paket bölme işini ağ kartından işlemciye alır. Sorunlu sürücülerde gecikmeyi düzeltir, işlemci yükünü artırır."],
    en: ["Disable Large Send Offload", "Moves packet segmentation from the network card to the CPU. Fixes latency on bad drivers at some CPU cost."],
  },
  "net.disable-netbios-adapters": {
    tr: ["NetBIOS'u kapat", "Tüm bağdaştırıcılarda TCP/IP üzerinden NetBIOS'u kapatır. Çok eski ağ paylaşımları etkilenebilir."],
    en: ["Turn off NetBIOS", "Disables NetBIOS over TCP/IP on every adapter. Very old network shares can be affected."],
  },

  // privacy
  "priv.telemetry-policy": {
    tr: ["Telemetriyi en aza indir", "Microsoft'a gönderilen tanılama verisini izin verilen en düşük düzeye çeker."],
    en: ["Minimise telemetry", "Sets diagnostic data sent to Microsoft to the lowest level allowed."],
  },
  "priv.advertising-id": {
    tr: ["Reklam kimliğini kapat", "Uygulamaların seni reklam için takip etmekte kullandığı kimliği kapatır."],
    en: ["Disable the advertising ID", "Turns off the identifier apps use to track you for ads."],
  },
  "priv.activity-history": {
    tr: ["Etkinlik geçmişini kapat", "Açtığın uygulama ve dosyaların kaydedilip Microsoft'a gönderilmesini durdurur."],
    en: ["Disable activity history", "Stops the apps and files you open being recorded and sent to Microsoft."],
  },
  "priv.background-apps": {
    tr: ["Arka plan uygulamalarını durdur", "Mağaza uygulamalarının kapalıyken çalışmasını engeller. Bildirimleri gecikebilir."],
    en: ["Stop background apps", "Stops Store apps running while closed. Their notifications can arrive late."],
  },
  "priv.cortana-websearch": {
    tr: ["Başlat menüsünden web sonuçlarını kaldır", "Başlat araması yalnızca bilgisayarındakileri gösterir; yazdıkların Bing'e gitmez."],
    en: ["Remove web results from Start", "Start search shows only what is on this PC; what you type is not sent to Bing."],
  },
  "priv.content-delivery": {
    tr: ["Önerileri ve otomatik kurulan uygulamaları kapat", "Başlat menüsü önerilerini, ipuçlarını ve kendiliğinden yüklenen uygulamaları kapatır."],
    en: ["Disable suggestions and auto-installed apps", "Turns off Start menu suggestions, tips and apps that install themselves."],
  },
  "priv.tailored-feedback": {
    tr: ["Kişiselleştirilmiş deneyimleri kapat", "Tanılama verisine dayalı önerileri ve geri bildirim isteklerini kapatır."],
    en: ["Disable tailored experiences", "Turns off suggestions based on diagnostic data, and feedback prompts."],
  },
  "priv.location": {
    tr: ["Konum erişimini kapat", "Tüm uygulamalar için konum erişimini reddeder."],
    en: ["Deny location access", "Denies location access for every app."],
  },
  "priv.copilot": {
    tr: ["Copilot'u kapat", "Windows Copilot'u ve görev çubuğu düğmesini kapatır."],
    en: ["Disable Copilot", "Turns off Windows Copilot and its taskbar button."],
  },
  "priv.recall": {
    tr: ["Recall'ı kapat", "Ekranının düzenli aralıklarla görüntüsünü alıp analiz eden özelliği kapatır."],
    en: ["Disable Recall", "Turns off the feature that periodically captures and analyses your screen."],
  },
  "priv.widgets": {
    tr: ["Pencere öğelerini kapat", "Görev çubuğundaki haber ve hava durumu panelini kapatır."],
    en: ["Disable Widgets", "Turns off the news and weather panel on the taskbar."],
  },
  "priv.edge-background": {
    tr: ["Edge'in arka planda çalışmasını durdur", "Edge'in açılışta önceden yüklenmesini ve kapatıldıktan sonra çalışmasını engeller."],
    en: ["Stop Edge running in the background", "Stops Edge preloading at startup and staying alive after it is closed."],
  },
  "priv.onedrive-autostart": {
    tr: ["OneDrive'ı başlangıçtan kaldır", "OneDrive oturum açılışında kendiliğinden başlamaz; elle açabilirsin."],
    en: ["Remove OneDrive from startup", "OneDrive no longer starts at sign-in; you can still open it yourself."],
  },
  "priv.store-auto-update": {
    tr: ["Mağaza otomatik güncellemelerini kapat", "Mağaza uygulamaları kendiliğinden güncellenmez; güvenlik için arada elle güncelle."],
    en: ["Disable Store auto-updates", "Store apps no longer update on their own; update them by hand now and then for security."],
  },
  "priv.update-auto-restart": {
    tr: ["Otomatik yeniden başlatmayı engelle", "Oturumun açıkken Windows Update bilgisayarı kendiliğinden yeniden başlatmaz."],
    en: ["Block automatic restarts", "Windows Update will not restart the PC on its own while you are signed in."],
  },

  // visual
  "ui.visual-effects-performance": {
    tr: ["Görsel efektleri performansa ayarla", "Animasyon, gölge ve yumuşatma efektlerini kapatır."],
    en: ["Visual effects for performance", "Turns off animation, shadow and smoothing effects."],
  },
  "ui.transparency": {
    tr: ["Saydamlığı kapat", "Görev çubuğu ve pencerelerdeki saydam efektleri kapatır."],
    en: ["Disable transparency", "Turns off translucent effects on the taskbar and windows."],
  },
  "ui.window-animations": {
    tr: ["Pencere animasyonlarını kapat", "Pencere küçültme, büyütme ve görev çubuğu animasyonlarını kapatır."],
    en: ["Disable window animations", "Turns off minimise, maximise and taskbar animations."],
  },
  "ui.explorer-chrome": {
    tr: ["Gezgin süslerini azalt", "Sallayarak küçültmeyi, seçim saydamlığını ve simge gölgelerini kapatır."],
    en: ["Trim Explorer decoration", "Turns off shake-to-minimise, translucent selection and icon shadows."],
  },
  "ui.snap-assist": {
    tr: ["Yaslama önerilerini kapat", "Pencereyi kenara yaslayınca çıkan öneri panellerini kapatır."],
    en: ["Disable Snap suggestions", "Turns off the suggestion panels shown when you snap a window."],
  },

  // display
  "disp.cleartype": {
    tr: ["ClearType'ı ayarla", "LCD ekranlar için yazı tipi yumuşatmasını açar ve kontrastını ayarlar."],
    en: ["Tune ClearType", "Turns on font smoothing for LCD panels and sets its contrast."],
  },
  "disp.color-calibration": {
    tr: ["Renk yönetimini sürücüye bırak", "Windows'un açılışta renk kalibrasyonu yüklemesini kapatır. Kendi ICC profilini kullanıyorsan açma."],
    en: ["Leave colour to the driver", "Stops Windows loading colour calibration at startup. Skip this if you use your own ICC profile."],
  },
  "disp.night-light": {
    tr: ["Gece ışığını sıfırla", "Takılı kalan gece ışığı ayarını siler; zamanlamayı yeniden kurman gerekir."],
    en: ["Reset Night Light", "Deletes a stuck Night Light setting; you will need to set its schedule again."],
  },
  "disp.auto-hdr-off": {
    tr: ["Otomatik HDR'ı kapat", "SDR oyunlara kendiliğinden HDR uygulanmasını kapatır."],
    en: ["Disable Auto HDR", "Stops HDR being applied automatically to SDR games."],
  },
  "disp.no-screensaver-sleep": {
    tr: ["Ekran koruyucuyu ve ekran kapanmasını kapat", "Prizdeyken ekran koruyucu açılmaz, ekran kendiliğinden kapanmaz."],
    en: ["Disable screen saver and screen-off", "On AC power, no screen saver starts and the display never turns itself off."],
  },

  // input
  "input.mouse-acceleration": {
    tr: ["Fare ivmesini kapat", "İmleç hızı el hızına göre değişmez; nişan almak tutarlı olur."],
    en: ["Disable mouse acceleration", "Pointer speed no longer depends on how fast you move; aim becomes consistent."],
  },
  "input.mouse-sensitivity-native": {
    tr: ["İmleç hızını 1:1 yap", "Windows imleç hızını, hareketin ölçeklenmediği orta ayara getirir."],
    en: ["Set pointer speed to 1:1", "Puts Windows pointer speed at the middle setting, where movement is not scaled."],
  },
  "input.keyboard-repeat": {
    tr: ["En hızlı tuş tekrarı", "Tuş basılı tutulduğunda tekrar gecikmesini en kısa, hızını en yüksek yapar."],
    en: ["Fastest key repeat", "Sets the shortest repeat delay and the highest repeat rate for held keys."],
  },
  "input.accessibility-shortcuts": {
    tr: ["Yapışkan tuş kısayollarını kapat", "Shift'e beş kez basınca çıkan Yapışkan, Filtre ve Geçiş Tuşları pencerelerini kapatır."],
    en: ["Disable Sticky Keys shortcuts", "Turns off the Sticky, Filter and Toggle Keys prompts, such as pressing Shift five times."],
  },
  "input.pointer-trails": {
    tr: ["İmleç izini kapat", "İmlecin arkasında bıraktığı izi kapatır."],
    en: ["Disable pointer trails", "Turns off the trail drawn behind the pointer."],
  },

  // storage
  "disk.ntfs-last-access": {
    tr: ["Son erişim zamanını yazma", "Her dosya okunuşunda diske zaman damgası yazılmasını kapatır."],
    en: ["Skip last-access timestamps", "Stops a timestamp being written to disk every time a file is read."],
  },
  "disk.ntfs-8dot3": {
    tr: ["8.3 kısa dosya adlarını kapat", "DOS dönemi kısa adların üretilmesini kapatır. Çok eski kurulum programları etkilenebilir."],
    en: ["Disable 8.3 short names", "Stops DOS-era short file names being generated. Very old installers can be affected."],
  },
  "disk.ntfs-memory-usage": {
    tr: ["NTFS önbelleğini büyüt", "Dosya sistemi için ayrılan belleği artırır; çok dosyalı işlemler hızlanır."],
    en: ["Enlarge the NTFS cache", "Gives the file system more memory, speeding up work with many files."],
  },
  "disk.enable-trim": {
    tr: ["TRIM'i aç", "SSD'ye silinen blokları bildirir; hızın ve ömrün korunmasını sağlar."],
    en: ["Enable TRIM", "Tells the SSD which blocks were deleted, preserving its speed and lifespan."],
  },
  "disk.hibernation-off": {
    tr: ["Hazırda bekletmeyi kapat", "hiberfil.sys dosyasını siler ve RAM boyutuna yakın disk alanı açar. Hızlı Başlatma da kapanır."],
    en: ["Disable hibernation", "Deletes hiberfil.sys, freeing disk space close to your RAM size. Fast Startup goes with it."],
  },
  "disk.prefetch-ssd": {
    tr: ["Prefetch'i kapat", "SSD'de gereksiz olan önyükleme kayıtlarını kapatır."],
    en: ["Disable Prefetch", "Turns off launch tracing, which an SSD does not need."],
  },
  "disk.reserved-storage": {
    tr: ["Ayrılmış depolamayı kapat", "Windows'un güncellemeler için ayırdığı yaklaşık 7 GB'ı geri verir. Disk doluyken güncelleme başarısız olabilir."],
    en: ["Disable reserved storage", "Returns the roughly 7 GB Windows sets aside for updates. Updates can fail when the disk is full."],
  },
  "disk.storage-sense": {
    tr: ["Depolama Algılayıcısı'nı aç", "Windows geçici dosyaları düzenli olarak kendiliğinden temizler."],
    en: ["Enable Storage Sense", "Windows clears temporary files on its own on a schedule."],
  },

  // maintenance
  "clean.temp-files": {
    tr: ["Geçici dosyaları temizle", "Kullanıcı ve Windows geçici klasörlerini boşaltır."],
    en: ["Clear temporary files", "Empties the user and Windows temp folders."],
  },
  "clean.windows-update-cache": {
    tr: ["Windows Update önbelleğini temizle", "İndirilmiş güncelleme dosyalarını siler; takılan güncellemeleri de çözer."],
    en: ["Clear the Windows Update cache", "Deletes downloaded update files; also unsticks a stuck update."],
  },
  "clean.shader-cache": {
    tr: ["Gölgelendirici önbelleklerini temizle", "DirectX ve ekran kartı önbelleklerini siler. Oyunlar ilk açılışta yeniden derler."],
    en: ["Clear shader caches", "Deletes DirectX and GPU caches. Games rebuild them on next launch."],
  },
  "clean.icon-thumbnail-cache": {
    tr: ["Simge ve küçük resim önbelleğini yenile", "Bozuk simgeleri düzeltir. Gezgin birkaç saniyeliğine yeniden başlar."],
    en: ["Rebuild icon and thumbnail caches", "Fixes broken icons. Explorer restarts for a few seconds."],
  },
  "clean.recycle-bin": {
    tr: ["Geri Dönüşüm Kutusu'nu boşalt", "Kutudaki her şeyi kalıcı olarak siler."],
    en: ["Empty the Recycle Bin", "Permanently deletes everything in the bin."],
  },
  "clean.dns-cache": {
    tr: ["DNS önbelleğini temizle", "Eski ad kayıtlarını siler; açılmayan siteleri düzeltebilir."],
    en: ["Flush the DNS cache", "Drops stale name records; can fix sites that will not load."],
  },
  "clean.delivery-optimization-files": {
    tr: ["Teslim iyileştirme önbelleğini sil", "Başka bilgisayarlarla paylaşmak için saklanan güncelleme dosyalarını siler."],
    en: ["Delete the Delivery Optimization cache", "Deletes update files kept for sharing with other PCs."],
  },
  "clean.optimize-volumes": {
    tr: ["Sürücüleri iyileştir", "SSD'lerde TRIM, sabit disklerde birleştirme çalıştırır. Uzun sürebilir."],
    en: ["Optimise drives", "Runs TRIM on SSDs and defragments hard disks. Can take a while."],
  },
  "clean.event-logs": {
    tr: ["Olay günlüklerini temizle", "Tüm Windows olay günlüklerini siler. Sorun giderirken işe yarayan geçmiş kaybolur."],
    en: ["Clear event logs", "Deletes every Windows event log. History that helps when troubleshooting is lost."],
  },
  "clean.winsock-reset": {
    tr: ["Ağ yığınını sıfırla", "Winsock ve TCP/IP'yi baştan kurar. Elle girilmiş IP ayarları silinir."],
    en: ["Reset the network stack", "Rebuilds Winsock and TCP/IP. Manual IP settings are erased."],
  },
  "clean.repair-system-files": {
    tr: ["Sistem dosyalarını onar", "DISM ve ardından SFC çalıştırır. 10-30 dakika sürer; bitene kadar pencereyi kapatma."],
    en: ["Repair system files", "Runs DISM, then SFC. Takes 10 to 30 minutes; keep the window open until it ends."],
  },
};

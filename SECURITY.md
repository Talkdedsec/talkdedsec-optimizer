# Security Policy

## Reporting a vulnerability

Please do **not** open a public issue for security problems.

- Use **Security > Report a vulnerability** on this repository (private vulnerability reporting), or
- email **talkdedsec@proton.me**.

Include the app version, your Windows version, the steps to reproduce and what you expected to happen. You will get a reply within 7 days.

## Scope

Talkdedsec runs with administrator rights and writes to the registry and to service settings, so these are in scope in particular:

- a tweak that writes somewhere other than what its catalog entry says,
- a revert that does not restore the saved value,
- any way for web content or a file to reach the privileged process,
- any network request that carries user data.

## Supported versions

Only the latest release receives fixes.

---

# Güvenlik Politikası

## Güvenlik açığı bildirme

Güvenlik sorunları için lütfen herkese açık issue **açmayın**.

- Bu depoda **Security > Report a vulnerability** (özel güvenlik açığı bildirimi) yolunu kullanın, ya da
- **talkdedsec@proton.me** adresine e-posta gönderin.

Uygulama sürümünü, Windows sürümünüzü, yeniden üretme adımlarını ve beklediğiniz davranışı yazın. 7 gün içinde yanıt alırsınız.

## Kapsam

Talkdedsec yönetici yetkisiyle çalışır, kayıt defterine ve servis ayarlarına yazar. Bu yüzden özellikle şunlar kapsamdadır:

- katalog kaydında yazandan başka bir yere yazan ayar,
- saklanan değeri geri yüklemeyen geri alma,
- web içeriğinin ya da bir dosyanın yetkili sürece ulaşabildiği herhangi bir yol,
- kullanıcı verisi taşıyan herhangi bir ağ isteği.

## Desteklenen sürümler

Yalnızca en son sürüm düzeltme alır.

// Natív platformon (iOS/Android) az expo-sqlite ad `localStorage`-ot, ebben marad meg a
// bejelentkezés az app újraindítása után is. Weben a böngésző saját localStorage-a van,
// ott ez a fájl nem töltődik be (ld. storage-install.ts).
import "expo-sqlite/localStorage/install";

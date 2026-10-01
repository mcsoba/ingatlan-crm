import { Linking } from "react-native";

// Telefonszám tárcsázható formára: szóközök, kötőjelek, zárójelek nélkül.
function dialable(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}

export function callPhone(phone: string) {
  Linking.openURL(`tel:${dialable(phone)}`).catch(() => {});
}

export function smsPhone(phone: string) {
  Linking.openURL(`sms:${dialable(phone)}`).catch(() => {});
}

export function sendEmail(email: string) {
  Linking.openURL(`mailto:${email}`).catch(() => {});
}

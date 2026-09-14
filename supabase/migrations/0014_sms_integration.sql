-- SMS-integráció (Twilio): csapattag telefonszám SMS-értesítésekhez,
-- és flag a megtekintés-emlékeztető SMS duplikálásának elkerülésére.

alter table public.profiles add column phone text;

alter table public.activities add column sms_reminder_sent boolean not null default false;

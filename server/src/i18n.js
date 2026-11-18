// الترجمة الفرنسية والإنجليزية لرسائل الخادم التي يراها الزبون (الأخطاء والإشعارات وأسماء الحالات)
// الرسائل تُكتب بالعربية في الكود، وتُترجم هنا عند الإرسال لزبون اختار الفرنسية.

const STATUS_FR = {
  awaiting_payment: 'En attente de paiement',
  payment_review: 'Paiement en vérification',
  confirmed: 'Payé — émission du billet en cours',
  ticketed: 'Billet émis',
  cancelled: 'Annulée',
  expired: 'Délai de paiement dépassé',
  refunded: 'Remboursée',
};
const REQUEST_FR = { new: 'Nouvelle', quoted: 'Offres reçues', accepted: 'Acceptée', closed: 'Fermée' };

const EXACT = {
  'أدخل رقم العملية أو أرفق صورة الإيصال': 'Saisissez le numéro de transaction ou joignez le reçu',
  'أرفق صورة بطاقة الطالب وشهادة التسجيل': "Joignez la carte d'étudiant et le certificat de scolarité",
  'أضف مسافراً واحداً على الأقل': 'Ajoutez au moins un passager',
  'اختر المسافر الطالب': "Choisissez le passager étudiant",
  'اختر رحلة': 'Choisissez un vol',
  'اختر طريقة دفع صحيحة': 'Choisissez un moyen de paiement valide',
  'اختر نوع الغرفة': 'Choisissez le type de chambre',
  'اكتب رسالة': 'Écrivez un message',
  'الباقة غير متاحة': "Ce forfait n'est pas disponible",
  'الحجز غير موجود': 'Réservation introuvable',
  'الحجز منتهٍ': 'Cette réservation est clôturée',
  'الحد الأقصى 9 مسافرين في الحجز الواحد': 'Maximum 9 passagers par réservation',
  'الحساب موقوف، تواصل مع الوكالة': "Compte suspendu, contactez l'agence",
  'الرحلة لم تعد متاحة': "Ce vol n'est plus disponible",
  'الطلب غير موجود': 'Demande introuvable',
  'العرض غير موجود': 'Offre introuvable',
  'المحادثة غير موجودة': 'Conversation introuvable',
  'الملف غير موجود': 'Fichier introuvable',
  'النقاط غير مفعّلة حالياً': 'Les points ne sont pas activés',
  'انتهت صلاحية نتائج البحث، ابحث من جديد': 'Les résultats ont expiré, relancez la recherche',
  'انتهت صلاحية هذا العرض، اطلب عرضاً جديداً': 'Cette offre a expiré, demandez-en une nouvelle',
  'انتهى الحجز في هذه الباقة': 'Les réservations pour ce forfait sont closes',
  'حدد المدينة والتاريخ': 'Indiquez la ville et la date',
  'حسابك غير موثّق كطالب، أرسل وثائقك أولاً': "Votre statut étudiant n'est pas vérifié, envoyez d'abord vos documents",
  'حسابك موثّق كطالب بالفعل': 'Votre statut étudiant est déjà vérifié',
  'رصيد نقاطك لا يكفي': 'Solde de points insuffisant',
  'رقم الهاتف أو كلمة المرور غير صحيحة': 'Téléphone ou mot de passe incorrect',
  'رقم الهاتف غير صحيح': 'Numéro de téléphone invalide',
  'رمز الدعوة غير صحيح': "Code d'invitation invalide",
  'سعر الطالب غير متاح لهذا النوع من الحجز': "Le tarif étudiant n'est pas disponible pour ce type de réservation",
  'صيغة تاريخ الميلاد 2003-05-20': 'Format de la date de naissance : 2003-05-20',
  'عدد الرضّع لا يمكن أن يتجاوز عدد البالغين': "Le nombre de bébés ne peut pas dépasser le nombre d'adultes",
  'عدد المسافرين لا يطابق البحث، ابحث من جديد': 'Le nombre de passagers ne correspond pas, relancez la recherche',
  'عدد المسافرين لا يطابق العرض': "Le nombre de passagers ne correspond pas à l'offre",
  'غير موجود': 'Introuvable',
  'كلمة المرور الجديدة قصيرة': 'Nouveau mot de passe trop court',
  'كلمة المرور الحالية غير صحيحة': 'Mot de passe actuel incorrect',
  'كلمة المرور يجب أن تكون 6 أحرف على الأقل': 'Le mot de passe doit contenir au moins 6 caractères',
  'لا توجد أماكن كافية في هذه الباقة': 'Plus assez de places dans ce forfait',
  'لا يمكن إرسال الدفع لهذا الحجز الآن': "Impossible d'envoyer un paiement pour cette réservation maintenant",
  'ليست لديك صلاحية': "Vous n'avez pas l'autorisation",
  'مدينة المغادرة والوصول متطابقتان': "Les villes de départ et d'arrivée sont identiques",
  'هذا الرقم مسجّل مسبقاً، سجّل الدخول': 'Ce numéro est déjà inscrit, connectez-vous',
  'هذا الطلب مغلق': 'Cette demande est fermée',
  'وصلت للحد الأقصى من المسافرين المحفوظين': 'Nombre maximum de passagers enregistrés atteint',
  'يجب أن يكون هناك بالغ واحد على الأقل': 'Il faut au moins un adulte',
  'تعذّر الاتصال بخادم Amadeus': 'Impossible de joindre le service de réservation',
  'Amadeus لم يرد في الوقت المحدد': "Le service de réservation n'a pas répondu à temps",
  'فشل الدخول إلى Amadeus: تحقق من المفاتيح في الإعدادات': 'Service de réservation indisponible',
  'لم يؤكد Amadeus السعر، ابحث من جديد': "Le prix n'a pas pu être confirmé, relancez la recherche",
  'يرجى تسجيل الدخول': 'Veuillez vous connecter',
  'الحساب غير موجود أو موقوف': 'Compte introuvable ou suspendu',
  'انتهت الجلسة، سجّل الدخول من جديد': 'Session expirée, reconnectez-vous',
  'حدث خطأ في الخادم': 'Erreur du serveur',
  'نوع الملف غير مسموح (صورة أو PDF فقط)': 'Type de fichier non autorisé (image ou PDF uniquement)',
  // الإشعارات
  'تم إنشاء حجزك': 'Votre réservation est créée',
  'تم رفع نسخة جديدة من تذكرتك.': 'Une nouvelle version de votre billet est disponible.',
  'رسالة جديدة من الوكالة': "Nouveau message de l'agence",
  'انتهت صلاحية نقاطك': 'Vos points ont expiré',
  'انتهى توثيق الطالب': 'Statut étudiant expiré',
  'انتهت صلاحية توثيقك كطالب. أرسل وثائق السنة الجديدة للاستفادة من سعر الطالب.': 'Votre statut étudiant a expiré. Envoyez les documents de la nouvelle année pour profiter du tarif étudiant.',
  'تم توثيقك كطالب': 'Statut étudiant vérifié',
  'لم يُقبل توثيق الطالب': 'Statut étudiant refusé',
  'وصلك عرض جديد': 'Nouvelle offre reçue',
  'مكافأة أول حجز لك عبر دعوة صديق.': 'Bonus pour votre première réservation via une invitation.',
  'استلمنا إثبات الدفع وسنتحقق منه قريباً.': 'Nous avons reçu votre preuve de paiement, vérification en cours.',
  'تم تأكيد الدفع. جاري إصدار تذكرتك.': 'Paiement confirmé. Émission de votre billet en cours.',
  'تذكرتك جاهزة! يمكنك تحميلها من حجوزاتي.': 'Votre billet est prêt ! Téléchargez-le depuis Mes réservations.',
  'انتهت مهلة الدفع وأُلغي الحجز تلقائياً.': 'Délai de paiement dépassé, réservation annulée automatiquement.',
  'تم استرجاع المبلغ.': 'Le montant a été remboursé.',
  'الحجز بانتظار الدفع.': 'Réservation en attente de paiement.',
};

const AR_STATUS_TO_FR = {};
const { STATUS_LABELS } = (() => {
  // تجنّب الاستيراد الدائري مع services.js
  return { STATUS_LABELS: { awaiting_payment: 'بانتظار الدفع', payment_review: 'جاري التحقق من الدفع', confirmed: 'مدفوع — جاري إصدار التذكرة', ticketed: 'تم إصدار التذكرة', cancelled: 'ملغى', expired: 'انتهت مهلة الدفع', refunded: 'تم الاسترجاع' } };
})();
for (const [k, v] of Object.entries(STATUS_LABELS)) AR_STATUS_TO_FR[v] = STATUS_FR[k];

const PATTERNS = [
  [/^أقل عدد نقاط يمكن استعماله هو (\d+)$/, (m) => `Minimum de points utilisables : ${m[1]}`],
  [/^أكمل بيانات المسافر (\d+)$/, (m) => `Complétez les informations du passager ${m[1]}`],
  [/^نوع المسافر (\d+) غير صحيح$/, (m) => `Type du passager ${m[1]} invalide`],
  [/^تغيّر سعر الرحلة (.+) إلى ([\d,]+)\. ابحث من جديد لترى السعر المحدّث\.$/, (m) => `Le prix du vol ${m[1]} est passé à ${m[2]}. Relancez la recherche pour voir le nouveau prix.`],
  [/^سعر الطالب للطالب نفسه فقط: الاسم يجب أن يطابق (.+)$/, (m) => `Le tarif étudiant est réservé à l'étudiant lui-même : le nom doit correspondre à ${m[1]}`],
  [/^سعر الطالب متاح لمن عمره (\d+) سنة أو أقل$/, (m) => `Tarif étudiant réservé aux ${m[1]} ans et moins`],
  [/^لا توجد مقاعد كافية في رحلة (.+)$/, (m) => `Plus assez de sièges sur le vol ${m[1]}`],
  [/^أدخل تاريخ ميلاد (.+)$/, (m) => `Saisissez la date de naissance de ${m[1]}`],
  [/^Amadeus: (.*)$/, (m) => `Service de réservation : ${m[1]}`],
  [/^حجز (\S+): تم تحديث التذكرة$/, (m) => `Réservation ${m[1]} : billet mis à jour`],
  [/^حجز (\S+): (.+)$/, (m) => `Réservation ${m[1]} : ${AR_STATUS_TO_FR[m[2]] || m[2]}`],
  [/^ربحت (\d+) نقطة$/, (m) => `Vous avez gagné ${m[1]} points`],
  [/^صديقك (.+) أكمل أول حجز له\. شكراً لدعوتك!$/, (m) => `Votre ami ${m[1]} a terminé sa première réservation. Merci pour l'invitation !`],
  [/^لم يكن هناك أي نشاط في حسابك منذ (\d+) شهراً\.$/, (m) => `Aucune activité sur votre compte depuis ${m[1]} mois.`],
  [/^يمكنك الآن الحجز بسعر الطالب \(خصم (\d+)%\) حتى (.+)\.$/, (m) => `Vous pouvez désormais réserver au tarif étudiant (-${m[1]} %) jusqu'au ${m[2]}.`],
  [/^السبب: (.+)\. يمكنك إعادة الإرسال\.$/, (m) => `Motif : ${m[1]}. Vous pouvez renvoyer vos documents.`],
  [/^أُضيفت (\d+) نقطة لرصيدك$/, (m) => `${m[1]} points ajoutés à votre solde`],
  [/^خُصمت (\d+) نقطة من رصيدك$/, (m) => `${m[1]} points retirés de votre solde`],
  [/^رقم الحجز (\S+)\. أكمل الدفع خلال (\d+) ساعة\.$/, (m) => `Réservation n° ${m[1]}. Payez dans les ${m[2]} heures.`],
  [/^أُضيفت (\d+) نقطة إلى رصيدك من الحجز (\S+)\.$/, (m) => `${m[1]} points ajoutés grâce à la réservation ${m[2]}.`],
  [/^عرض (.+) بسعر ([\d,]+) (\S+) لرحلتك إلى (.+)\.$/, (m) => `Offre ${m[1]} à ${m[2]} ${m[3]} pour votre voyage.`],
  [/^تم إلغاء الحجز\.(.*)$/, (m) => `Réservation annulée.${m[1]}`],
  [/^رُفض إثبات الدفع: (.+)\. يرجى إعادة الإرسال\.$/, (m) => `Preuve de paiement refusée : ${m[1]}. Veuillez la renvoyer.`],
];

const STATUS_EN = {
  awaiting_payment: 'Awaiting payment',
  payment_review: 'Payment being verified',
  confirmed: 'Paid — ticket being issued',
  ticketed: 'Ticket issued',
  cancelled: 'Cancelled',
  expired: 'Payment deadline passed',
  refunded: 'Refunded',
};
const REQUEST_EN = { new: 'New', quoted: 'Offers received', accepted: 'Accepted', closed: 'Closed' };
const AR_STATUS_TO_EN = {};
for (const [k, v] of Object.entries(STATUS_LABELS)) AR_STATUS_TO_EN[v] = STATUS_EN[k];

const EXACT_EN = {
  'أدخل رقم العملية أو أرفق صورة الإيصال': 'Enter the transaction number or attach the receipt',
  'أرفق صورة بطاقة الطالب وشهادة التسجيل': 'Attach your student card and enrolment certificate',
  'أضف مسافراً واحداً على الأقل': 'Add at least one passenger',
  'اختر المسافر الطالب': 'Choose the student passenger',
  'اختر رحلة': 'Choose a flight',
  'اختر طريقة دفع صحيحة': 'Choose a valid payment method',
  'اختر نوع الغرفة': 'Choose a room type',
  'اكتب رسالة': 'Write a message',
  'الباقة غير متاحة': 'This package is not available',
  'الحجز غير موجود': 'Booking not found',
  'الحجز منتهٍ': 'This booking is closed',
  'الحد الأقصى 9 مسافرين في الحجز الواحد': 'Maximum 9 passengers per booking',
  'الحساب موقوف، تواصل مع الوكالة': 'Account suspended, please contact the agency',
  'الرحلة لم تعد متاحة': 'This flight is no longer available',
  'الطلب غير موجود': 'Request not found',
  'العرض غير موجود': 'Offer not found',
  'المحادثة غير موجودة': 'Conversation not found',
  'الملف غير موجود': 'File not found',
  'النقاط غير مفعّلة حالياً': 'Points are not enabled',
  'انتهت صلاحية نتائج البحث، ابحث من جديد': 'Search results expired, please search again',
  'انتهت صلاحية هذا العرض، اطلب عرضاً جديداً': 'This offer has expired, request a new one',
  'انتهى الحجز في هذه الباقة': 'Booking for this package is closed',
  'حدد المدينة والتاريخ': 'Choose the city and date',
  'حسابك غير موثّق كطالب، أرسل وثائقك أولاً': 'Your student status is not verified, send your documents first',
  'حسابك موثّق كطالب بالفعل': 'Your student status is already verified',
  'رصيد نقاطك لا يكفي': 'Not enough points',
  'رقم الهاتف أو كلمة المرور غير صحيحة': 'Wrong phone number or password',
  'رقم الهاتف غير صحيح': 'Invalid phone number',
  'رمز الدعوة غير صحيح': 'Invalid invitation code',
  'سعر الطالب غير متاح لهذا النوع من الحجز': 'The student fare is not available for this type of booking',
  'صيغة تاريخ الميلاد 2003-05-20': 'Date of birth format: 2003-05-20',
  'عدد الرضّع لا يمكن أن يتجاوز عدد البالغين': 'Infants cannot outnumber adults',
  'عدد المسافرين لا يطابق البحث، ابحث من جديد': 'Passenger count does not match, please search again',
  'عدد المسافرين لا يطابق العرض': 'Passenger count does not match the offer',
  'غير موجود': 'Not found',
  'كلمة المرور الجديدة قصيرة': 'New password is too short',
  'كلمة المرور الحالية غير صحيحة': 'Current password is incorrect',
  'كلمة المرور يجب أن تكون 6 أحرف على الأقل': 'Password must be at least 6 characters',
  'لا توجد أماكن كافية في هذه الباقة': 'Not enough places left in this package',
  'لا يمكن إرسال الدفع لهذا الحجز الآن': 'Payment cannot be sent for this booking now',
  'ليست لديك صلاحية': 'You are not allowed to do this',
  'مدينة المغادرة والوصول متطابقتان': 'Departure and arrival cities are the same',
  'هذا الرقم مسجّل مسبقاً، سجّل الدخول': 'This number is already registered, please log in',
  'هذا الطلب مغلق': 'This request is closed',
  'وصلت للحد الأقصى من المسافرين المحفوظين': 'Maximum number of saved travellers reached',
  'يجب أن يكون هناك بالغ واحد على الأقل': 'At least one adult is required',
  'تعذّر الاتصال بخادم Amadeus': 'The booking service cannot be reached',
  'Amadeus لم يرد في الوقت المحدد': 'The booking service did not respond in time',
  'فشل الدخول إلى Amadeus: تحقق من المفاتيح في الإعدادات': 'Booking service unavailable',
  'لم يؤكد Amadeus السعر، ابحث من جديد': 'The price could not be confirmed, please search again',
  'يرجى تسجيل الدخول': 'Please log in',
  'الحساب غير موجود أو موقوف': 'Account not found or suspended',
  'انتهت الجلسة، سجّل الدخول من جديد': 'Session expired, please log in again',
  'حدث خطأ في الخادم': 'Server error',
  'نوع الملف غير مسموح (صورة أو PDF فقط)': 'File type not allowed (image or PDF only)',
  'تم إنشاء حجزك': 'Your booking has been created',
  'تم رفع نسخة جديدة من تذكرتك.': 'A new version of your ticket is available.',
  'رسالة جديدة من الوكالة': 'New message from the agency',
  'انتهت صلاحية نقاطك': 'Your points have expired',
  'انتهى توثيق الطالب': 'Student status expired',
  'انتهت صلاحية توثيقك كطالب. أرسل وثائق السنة الجديدة للاستفادة من سعر الطالب.': "Your student status has expired. Send this year's documents to keep the student fare.",
  'تم توثيقك كطالب': 'Student status verified',
  'لم يُقبل توثيق الطالب': 'Student verification declined',
  'وصلك عرض جديد': 'You received a new offer',
  'مكافأة أول حجز لك عبر دعوة صديق.': 'Bonus for your first booking through an invitation.',
  'استلمنا إثبات الدفع وسنتحقق منه قريباً.': 'We received your proof of payment and will verify it shortly.',
  'تم تأكيد الدفع. جاري إصدار تذكرتك.': 'Payment confirmed. Your ticket is being issued.',
  'تذكرتك جاهزة! يمكنك تحميلها من حجوزاتي.': 'Your ticket is ready! Download it from My bookings.',
  'انتهت مهلة الدفع وأُلغي الحجز تلقائياً.': 'The payment deadline passed and the booking was cancelled.',
  'تم استرجاع المبلغ.': 'The amount has been refunded.',
  'الحجز بانتظار الدفع.': 'The booking is awaiting payment.',
};

const PATTERNS_EN = [
  [/^أقل عدد نقاط يمكن استعماله هو (\d+)$/, (m) => `Minimum points you can use: ${m[1]}`],
  [/^أكمل بيانات المسافر (\d+)$/, (m) => `Complete passenger ${m[1]} details`],
  [/^نوع المسافر (\d+) غير صحيح$/, (m) => `Passenger ${m[1]} type is invalid`],
  [/^تغيّر سعر الرحلة (.+) إلى ([\d,]+)\. ابحث من جديد لترى السعر المحدّث\.$/, (m) => `The price of flight ${m[1]} changed to ${m[2]}. Search again to see the updated price.`],
  [/^سعر الطالب للطالب نفسه فقط: الاسم يجب أن يطابق (.+)$/, (m) => `The student fare is for the student only: the name must match ${m[1]}`],
  [/^سعر الطالب متاح لمن عمره (\d+) سنة أو أقل$/, (m) => `The student fare is for students aged ${m[1]} or under`],
  [/^لا توجد مقاعد كافية في رحلة (.+)$/, (m) => `Not enough seats on flight ${m[1]}`],
  [/^أدخل تاريخ ميلاد (.+)$/, (m) => `Enter the date of birth of ${m[1]}`],
  [/^Amadeus: (.*)$/, (m) => `Booking service: ${m[1]}`],
  [/^حجز (\S+): تم تحديث التذكرة$/, (m) => `Booking ${m[1]}: ticket updated`],
  [/^حجز (\S+): (.+)$/, (m) => `Booking ${m[1]}: ${AR_STATUS_TO_EN[m[2]] || m[2]}`],
  [/^ربحت (\d+) نقطة$/, (m) => `You earned ${m[1]} points`],
  [/^صديقك (.+) أكمل أول حجز له\. شكراً لدعوتك!$/, (m) => `Your friend ${m[1]} completed their first booking. Thanks for the invite!`],
  [/^لم يكن هناك أي نشاط في حسابك منذ (\d+) شهراً\.$/, (m) => `No activity on your account for ${m[1]} months.`],
  [/^يمكنك الآن الحجز بسعر الطالب \(خصم (\d+)%\) حتى (.+)\.$/, (m) => `You can now book at the student fare (-${m[1]}%) until ${m[2]}.`],
  [/^السبب: (.+)\. يمكنك إعادة الإرسال\.$/, (m) => `Reason: ${m[1]}. You can send your documents again.`],
  [/^أُضيفت (\d+) نقطة لرصيدك$/, (m) => `${m[1]} points added to your balance`],
  [/^خُصمت (\d+) نقطة من رصيدك$/, (m) => `${m[1]} points removed from your balance`],
  [/^رقم الحجز (\S+)\. أكمل الدفع خلال (\d+) ساعة\.$/, (m) => `Booking ${m[1]}. Please pay within ${m[2]} hours.`],
  [/^أُضيفت (\d+) نقطة إلى رصيدك من الحجز (\S+)\.$/, (m) => `${m[1]} points added from booking ${m[2]}.`],
  [/^عرض (.+) بسعر ([\d,]+) (\S+) لرحلتك إلى (.+)\.$/, (m) => `${m[1]} offer at ${m[2]} ${m[3]} for your trip.`],
  [/^تم إلغاء الحجز\.(.*)$/, (m) => `Booking cancelled.${m[1]}`],
  [/^رُفض إثبات الدفع: (.+)\. يرجى إعادة الإرسال\.$/, (m) => `Proof of payment declined: ${m[1]}. Please send it again.`],
];

function translate(text, lang) {
  if (!text || (lang !== 'fr' && lang !== 'en')) return text;
  const exact = lang === 'en' ? EXACT_EN : EXACT;
  const patterns = lang === 'en' ? PATTERNS_EN : PATTERNS;
  if (exact[text]) return exact[text];
  for (const [re, fn] of patterns) {
    const m = re.exec(text);
    if (m) return fn(m);
  }
  return text;
}

function labels(lang) {
  if (lang === 'fr') return { status: STATUS_FR, request: REQUEST_FR };
  if (lang === 'en') return { status: STATUS_EN, request: REQUEST_EN };
  const S = require('./services');
  return { status: S.STATUS_LABELS, request: S.REQUEST_LABELS };
}

module.exports = { translate, labels };

import { useEffect, useState } from "react";

export type Locale = "en" | "fr" | "ar";
export const localeDirection: Record<Locale, "ltr" | "rtl"> = { en: "ltr", fr: "ltr", ar: "rtl" };

const translations: Record<Locale, Record<string, string>> = {
  en: {
    appName: "SupplyQuest DZ", foundation: "Foundation", overview: "Overview", settings: "Settings",
    planned: "Planned", signIn: "Sign in", register: "Create account", email: "Email address", password: "Password",
    organization: "Organization", firstName: "First name", lastName: "Last name", logout: "Log out",
    welcome: "Good morning", foundationTitle: "Your operational foundation", foundationSubtitle: "A secure starting point for your supply chain workspace.",
    users: "Users", warehouses: "Warehouses", products: "Products", suppliers: "Suppliers", customers: "Customers",
    categories: "Categories", adminAccess: "Admin access", adminReady: "Role authorization is active for this account.",
    noData: "No data available yet.", loading: "Loading…", language: "Language", english: "English", french: "Français", arabic: "العربية",
    createOrganization: "Organization name", slug: "Workspace slug", signInPrompt: "Sign in to your workspace", registerPrompt: "Create your demo workspace",
    needAccount: "Need an account?", alreadyAccount: "Already have an account?", submit: "Continue", showPassword: "Use at least 8 characters.",
    invalidLogin: "Unable to sign in with those details.",
    intelligence: "Intelligence", recommendations: "Recommendations", alerts: "Alerts", inventoryHealth: "Inventory health",
    supplierPerformance: "Supplier performance", warehouseComparison: "Warehouse comparison", operationalSignals: "Operational signals",
  },
  fr: {
    appName: "SupplyQuest DZ", foundation: "Fondation", overview: "Vue d’ensemble", settings: "Paramètres",
    planned: "Bientôt", signIn: "Se connecter", register: "Créer un compte", email: "Adresse e-mail", password: "Mot de passe",
    organization: "Organisation", firstName: "Prénom", lastName: "Nom", logout: "Se déconnecter",
    welcome: "Bonjour", foundationTitle: "Votre fondation opérationnelle", foundationSubtitle: "Un point de départ sécurisé pour votre chaîne d’approvisionnement.",
    users: "Utilisateurs", warehouses: "Entrepôts", products: "Produits", suppliers: "Fournisseurs", customers: "Clients",
    categories: "Catégories", adminAccess: "Accès administrateur", adminReady: "L’autorisation par rôle est active pour ce compte.",
    noData: "Aucune donnée disponible.", loading: "Chargement…", language: "Langue", english: "English", french: "Français", arabic: "العربية",
    createOrganization: "Nom de l’organisation", slug: "Identifiant de l’espace", signInPrompt: "Accédez à votre espace", registerPrompt: "Créez votre espace démo",
    needAccount: "Pas encore de compte ?", alreadyAccount: "Vous avez déjà un compte ?", submit: "Continuer", showPassword: "8 caractères minimum.",
    invalidLogin: "Impossible de vous connecter avec ces informations.",
    intelligence: "Intelligence", recommendations: "Recommandations", alerts: "Alertes", inventoryHealth: "Santé des stocks",
    supplierPerformance: "Performance fournisseurs", warehouseComparison: "Comparaison des entrepôts", operationalSignals: "Signaux opérationnels",
  },
  ar: {
    appName: "SupplyQuest DZ", foundation: "الأساس", overview: "نظرة عامة", settings: "الإعدادات",
    planned: "قريباً", signIn: "تسجيل الدخول", register: "إنشاء حساب", email: "البريد الإلكتروني", password: "كلمة المرور",
    organization: "المؤسسة", firstName: "الاسم", lastName: "اللقب", logout: "تسجيل الخروج",
    welcome: "مرحباً", foundationTitle: "أساسك التشغيلي", foundationSubtitle: "بداية آمنة لمساحة سلسلة التوريد الخاصة بك.",
    users: "المستخدمون", warehouses: "المخازن", products: "المنتجات", suppliers: "الموردون", customers: "العملاء",
    categories: "الفئات", adminAccess: "صلاحية المسؤول", adminReady: "التخويل حسب الدور فعال لهذا الحساب.",
    noData: "لا توجد بيانات بعد.", loading: "جار التحميل…", language: "اللغة", english: "English", french: "Français", arabic: "العربية",
    createOrganization: "اسم المؤسسة", slug: "معرف مساحة العمل", signInPrompt: "سجل الدخول إلى مساحتك", registerPrompt: "أنشئ مساحة تجريبية",
    needAccount: "لا تملك حساباً؟", alreadyAccount: "لديك حساب بالفعل؟", submit: "متابعة", showPassword: "8 أحرف على الأقل.",
    invalidLogin: "تعذر تسجيل الدخول بهذه المعلومات.",
    intelligence: "التحليلات", recommendations: "التوصيات", alerts: "التنبيهات", inventoryHealth: "صحة المخزون",
    supplierPerformance: "أداء الموردين", warehouseComparison: "مقارنة المخازن", operationalSignals: "الإشارات التشغيلية",
  },
};

export function useLocale() {
  const [locale, setLocale] = useState<Locale>(() => (localStorage.getItem("supplyquest_locale") as Locale) || "en");
  useEffect(() => {
    localStorage.setItem("supplyquest_locale", locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = localeDirection[locale];
  }, [locale]);
  const t = (key: string) => translations[locale][key] ?? translations.en[key] ?? key;
  return { locale, setLocale, t, direction: localeDirection[locale] };
}
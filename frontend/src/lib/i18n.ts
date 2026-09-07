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
    forecasting: "Forecasting", forecastableProducts: "Forecastable products", insufficientData: "Insufficient data",
    highQualityForecasts: "High-quality forecasts", averageMae: "Average MAE", averageRmse: "Average RMSE",
    forecastRuns: "Forecast runs", generateForecast: "Generate forecast", horizon: "Horizon", method: "Method",
    forecastQuality: "Forecast quality", dataSufficiency: "Data sufficiency", trend: "Trend", seasonality: "Seasonality",
    uncertainty: "Uncertainty", historicalDemand: "Historical demand", forecastDemand: "Forecast demand",
    forecastVsActual: "Forecast vs actual", whyForecast: "Why this forecast was generated", noForecast: "No forecast generated yet",
    generate: "Generate", generating: "Generating…", forecastGenerated: "Forecast generated", noUncertainty: "Uncertainty range unavailable for this forecast.",
    refresh: "Refresh", sufficientHistory: "Enough history for comparison", forecastHistory: "Forecast history", qualityDistribution: "Quality distribution",
    methodComparison: "Method comparison", recentForecastRuns: "Recent forecast runs", generated: "Generated", available: "Available",
    notAvailable: "Not available", notDetected: "Not detected", date: "Date", predicted: "Predicted", estimatedRange: "Estimated range",
    backtesting: "Chronological backtesting", observations: "observations", actual: "Actual", error: "Error", noBacktest: "No backtest points available.",
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
    forecasting: "Prévisions", forecastableProducts: "Produits prévisibles", insufficientData: "Données insuffisantes",
    highQualityForecasts: "Prévisions de haute qualité", averageMae: "MAE moyenne", averageRmse: "RMSE moyenne",
    forecastRuns: "Exécutions de prévision", generateForecast: "Générer une prévision", horizon: "Horizon", method: "Méthode",
    forecastQuality: "Qualité de la prévision", dataSufficiency: "Suffisance des données", trend: "Tendance", seasonality: "Saisonnalité",
    uncertainty: "Incertitude", historicalDemand: "Demande historique", forecastDemand: "Demande prévue",
    forecastVsActual: "Prévision vs réel", whyForecast: "Pourquoi cette prévision a été générée", noForecast: "Aucune prévision générée",
    generate: "Générer", generating: "Génération…", forecastGenerated: "Prévision générée", noUncertainty: "Intervalle d’incertitude indisponible pour cette prévision.",
    refresh: "Actualiser", sufficientHistory: "Historique suffisant pour comparer", forecastHistory: "Historique des prévisions", qualityDistribution: "Répartition de la qualité",
    methodComparison: "Comparaison des méthodes", recentForecastRuns: "Prévisions récentes", generated: "Générée", available: "Disponible",
    notAvailable: "Indisponible", notDetected: "Non détectée", date: "Date", predicted: "Prévu", estimatedRange: "Intervalle estimé",
    backtesting: "Backtesting chronologique", observations: "observations", actual: "Réel", error: "Erreur", noBacktest: "Aucun point de backtesting disponible.",
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
    forecasting: "التنبؤ", forecastableProducts: "المنتجات القابلة للتنبؤ", insufficientData: "بيانات غير كافية",
    highQualityForecasts: "تنبؤات عالية الجودة", averageMae: "متوسط MAE", averageRmse: "متوسط RMSE",
    forecastRuns: "عمليات التنبؤ", generateForecast: "إنشاء تنبؤ", horizon: "الأفق", method: "الطريقة",
    forecastQuality: "جودة التنبؤ", dataSufficiency: "كفاية البيانات", trend: "الاتجاه", seasonality: "الموسمية",
    uncertainty: "عدم اليقين", historicalDemand: "الطلب التاريخي", forecastDemand: "الطلب المتوقع",
    forecastVsActual: "التنبؤ مقابل الفعلي", whyForecast: "لماذا تم إنشاء هذا التنبؤ", noForecast: "لم يتم إنشاء تنبؤ بعد",
    generate: "إنشاء", generating: "جار الإنشاء…", forecastGenerated: "تم إنشاء التنبؤ", noUncertainty: "نطاق عدم اليقين غير متاح لهذا التنبؤ.",
    refresh: "تحديث", sufficientHistory: "سجل كافٍ للمقارنة", forecastHistory: "سجل التنبؤات", qualityDistribution: "توزيع الجودة",
    methodComparison: "مقارنة الطرق", recentForecastRuns: "عمليات التنبؤ الأخيرة", generated: "تم الإنشاء", available: "متاح",
    notAvailable: "غير متاح", notDetected: "غير مكتشف", date: "التاريخ", predicted: "المتوقع", estimatedRange: "النطاق التقديري",
    backtesting: "اختبار زمني رجعي", observations: "الملاحظات", actual: "الفعلي", error: "الخطأ", noBacktest: "لا تتوفر نقاط اختبار رجعي.",
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
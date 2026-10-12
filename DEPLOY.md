# RevSpeed CRM — Guide de déploiement Vercel

## 1. Configurer les variables d'environnement sur Vercel

Aller dans : **Vercel Dashboard → revspeed-crmd → Settings → Environment Variables**

Ajouter ces 3 variables :

| Variable | Valeur | Environnement |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://ruvudxuecygqzpjladsu.supabase.co` | Production, Preview |
| `VITE_SUPABASE_ANON_KEY` | `ta_clé_anon_key` | Production, Preview |
| `VITE_ACCESS_PASSWORD` | Mot de passe de ton choix (ex: Triumph2024!) | Production |

> **Où trouver la clé Supabase ?**
> supabase.com → ton projet → Settings → API → `anon public`

## 2. Redéployer

Après avoir ajouté les variables : **Deployments → Redeploy** (le dernier déploiement)

## 3. Vérifier

- Le CRM demande maintenant un mot de passe ✅
- Plus de logs Supabase dans la console du navigateur ✅
- Les leads Facebook s'importent automatiquement ✅

## 4. Sécurité Supabase (RLS)

Dans Supabase : **Table Editor → Leads → RLS** 
- Activer Row Level Security
- Ajouter une policy : `select` autorisé pour `anon` (lecture seule)
- Les leads peuvent être lus mais pas modifiés depuis le navigateur

## 5. Architecture actuelle

```
Facebook Ads → Supabase "Leads" (lecture seule)
                    ↓
            RevSpeed CRM (Vercel)
                    ↓
            localStorage (état CRM : statut, vendeur, notes, RDV)
```

## Prochaine étape : Migration Google Sheets

Pour que le client soit propriétaire de ses données :
1. Google Apps Script exposé comme API REST
2. RevSpeed lit/écrit dans le Google Sheet du client
3. Supabase devient optionnel

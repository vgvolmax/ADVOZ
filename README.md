# ADVOZ — Ozon CPC Optimizer v2

Локальное браузерное приложение для пакетного анализа рекламных отчётов Ozon примерно за 3 месяца.

## Что делает v2

Приложение анализирует **фактически достигнутый CPC (`AchievedCPC`)**, а не номинальную ставку из интерфейса Ozon.

Pipeline:

```text
XLSX
→ нормализация и контроль качества
→ устойчивые CPC-regimes
→ rolling-7d EffectiveBudgetState
→ price regimes
→ квазиэкспериментальные исторические переходы
→ CLEAN / MIXED / UNCERTAIN
→ MDE / Power
→ OBSERVATIONAL evaluator
→ response evidence
→ TargetCPC + карточка следующего теста
  или NO_FEASIBLE_TEST
```

Все выводы из исторических переходов маркируются как **`OBSERVATIONAL`**. `DEPLOY` / `ROLLBACK` — операционные рекомендации по наблюдательному evidence, а не утверждение о причинно доказанном эффекте.

## Ключевые ограничения модели

- `Spend` не используется как control в regression полного эффекта CPC.
- `Spend ≈ CPC × Clicks` используется только как data-quality check.
- точный установленный недельный бюджет и Coverage не восстанавливаются;
- rolling-7d Spend используется только для вывода эффективного бюджетного состояния;
- структурный сдвиг Spend сам по себе не доказывает смену бюджета: при неоднозначности используется `BUDGET_STATE_UNCERTAIN`;
- следующий тест не рекомендуется, если он не отделим от CPC-шума или нужная мощность недостижима за разумный срок (`NO_FEASIBLE_TEST`).

Полная утверждённая математическая спецификация: [`Ozon_CPC_Optimizer_v2_FINAL_SPEC.md`](Ozon_CPC_Optimizer_v2_FINAL_SPEC.md).

## Статус реализации относительно финальной спецификации

Текущая ветка реализует **ядро v2 и рабочий пакетный UI**, но не выдаёт нереализованные части спецификации за готовые. Ниже зафиксированы осознанно отложенные пункты.

### Реализовано

- `AchievedCPC` как главная CPC-переменная и `TargetCPC` как следующий фактический режим;
- автоматическое выделение устойчивых CPC-regimes и change points;
- исключение `Spend` из total-effect decision path;
- rolling-7d `EffectiveBudgetState` без восстановления точного установленного бюджета или Coverage;
- `BUDGET_CONSTRAINED / BUDGET_UNCONSTRAINED / BUDGET_CAP_CHANGED / BUDGET_STATE_UNCERTAIN` с консервативной трактовкой неоднозначности;
- price regimes и conservative order reconstruction;
- `CLEAN_CPC_TRANSITION / MIXED_CPC_BUDGET_TRANSITION / PRICE_CONFOUNDED_TRANSITION / OTHER_CONFOUNDED_TRANSITION / TRANSITION_UNCERTAIN`;
- обязательная маркировка исторического основания как `OBSERVATIONAL`;
- regime-level business metrics;
- MDE/power feasibility с empirical variance и Poisson variance floor для заказов;
- `DEPLOY / ROLLBACK / EXTEND / INCONCLUSIVE` как операционные observational-решения;
- `NO_FEASIBLE_TEST` при недостижимой мощности или неотделимом от CPC-шума шаге;
- полный next-test card: baseline, TargetCPC, corridor, separation, minimum days, primary KPI volume, maximum horizon, stabilization, stop-loss, mixed conditions, reload rule и possible decisions;
- локальный response evidence и ограничение дальней экстраполяции;
- локальный browser-only запуск без backend/npm runtime/CDN;
- статические, интеграционные и adversarial-тесты плюс CI guard против старого `logSpend`/day-to-day decision path.

### Осознанно отложено и не должно трактоваться как реализованное

1. **Lag evaluator 0/+1/+2 (§17).** Сейчас evaluator сравнивает regime-level outcomes без отдельного conflict check между lag 0, +1 и +2. До реализации lag layer UI не должен утверждать, что лаговая устойчивость проверена.
2. **Полная сезонная корректировка (§11, §16).** Weekday composition сохраняется, но отдельная weekday/trend-adjusted модель эффекта ещё не реализована. Текущие переходы поэтому остаются `OBSERVATIONAL` и консервативно понижаются при явных confounders, но это не полноценная interrupted-time-series оценка.
3. **BH/FDR (§20).** В текущем ядре нет набора transition p-values, поэтому FDR пока не применяется. Его нужно добавлять вместе с полноценным inferential transition layer, а не имитировать без p-values.
4. **Block bootstrap / regime resampling / Monte-Carlo calibration (§21).** Текущий CI проверяет детерминированные и adversarial synthetic cases, но статистическая калибровка false-positive/sign-recovery ещё не выполнена.
5. **Confidence score (§31).** Числовой `Confidence 0–100` намеренно не показывается, пока score не откалиброван; это лучше, чем создать ложную вероятность истины.
6. **Полная contribution-profit экономика (§15).** Сейчас поддерживаются упрощённые входы `unitContributionBeforeAds` или `contributionMarginRate`. Полный разбор COGS, marketplace fees, logistics, taxes, buyout/returns/compensations требует дополнительных входных данных и остаётся следующим слоем.
7. **Гладкая нелинейная response curve и математический `CPC*` (§27–29).** Сейчас используются наблюдаемые локальные response points и следующий ограниченный TargetCPC. Далёкая экстраполяция запрещена; полноценный smooth optimum не заявляется.
8. **Heterogeneity по budget regimes (§28).** Отдельные CPC-кривые по бюджетным состояниям не строятся до появления достаточного evidence, как и требует спецификация.
9. **Полное разделение UI-меток `OBSERVED / ESTIMATED / INFERRED / RECOMMENDED` (§30).** Ключевые `OBSERVATIONAL`, budget-state и recommendation labels уже разделены, но полный semantic tagging каждого показателя ещё требует отдельного UI-прохода.

Эти пункты являются **следующей калибровочной/статистической фазой**, а не скрытыми возможностями текущей версии.

## Запуск

Никакой установки не требуется.

1. Скачайте репозиторий.
2. Откройте `index.html` двойным кликом в современном браузере.
3. Загрузите XLSX Ozon.
4. Выберите рекламную кампанию, если их несколько.
5. При необходимости задайте MDE, максимальный срок теста и входы юнит-экономики.

Приложение работает локально: backend, npm и внешние CDN не используются.

## Карточка следующего теста

Если тест реализуем, приложение показывает:

- текущий `AchievedCPC`;
- `TargetCPC` и допустимый коридор;
- минимальный separation от фонового CPC-шума;
- минимальное число полных evaluation-дней;
- требуемый объём primary KPI;
- максимальный срок;
- stabilization period;
- stop-loss;
- условия признания перехода смешанным;
- когда повторно загрузить отчёт;
- возможные решения: `DEPLOY / ROLLBACK / EXTEND / INCONCLUSIVE`.

## Проверка

Тесты не требуют npm:

```bash
for test_file in tests/*.test.js; do node "$test_file"; done
```

CI дополнительно выполняет `node --check` для JavaScript и запрещает попадание старого spend-adjusted/day-to-day decision path (`logSpend`, `fitDifferencedElasticity`, `marginalCpo`) в `src/`, `app.js` или `index.html`.

## Архитектурные документы

- `docs/superpowers/specs/2026-08-27-advoz-v2-architecture-design.md`
- `docs/superpowers/plans/2026-08-27-advoz-v2-implementation.md`

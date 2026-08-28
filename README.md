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
→ regime metrics
→ temporal calibration: lag 0/+1/+2 + weekday + linear trend
→ moving-block residual bootstrap: CI + p-value
→ MDE / Power
→ OBSERVATIONAL evaluator
→ campaign-wide Benjamini–Hochberg / q-value
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
- temporal adjustment, bootstrap CI, `p` и `q` **не превращают** исторический переход в причинный эксперимент: основание остаётся `OBSERVATIONAL`;
- `q` используется как multiplicity safeguard, а не как вероятность того, что вывод верен;
- следующий тест не рекомендуется, если он не отделим от CPC-шума или нужная мощность недостижима за разумный срок (`NO_FEASIBLE_TEST`).

Полная утверждённая математическая спецификация: [`Ozon_CPC_Optimizer_v2_FINAL_SPEC.md`](Ozon_CPC_Optimizer_v2_FINAL_SPEC.md).

## Статус реализации относительно финальной спецификации

Текущая версия реализует **ядро v2, temporal calibration, bootstrap uncertainty, BH/FDR safeguard и рабочий пакетный UI**, но не выдаёт нереализованные части спецификации за готовые.

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
- **temporal calibration для clean transitions:** lag `0/+1/+2`, weekday fixed effects и линейный календарный trend;
- `LAG_STABLE / LAG_SENSITIVE / LAG_NOT_IDENTIFIED`;
- `LAG_SENSITIVE` и `LAG_NOT_IDENTIFIED` блокируют сильные `DEPLOY/ROLLBACK`;
- при `LAG_STABLE` evaluator предпочитает `TEMPORAL_ADJUSTED` effect сырому regime mean difference;
- **moving-block residual bootstrap** с блоками внутри baseline/test regimes;
- bootstrap CI по full-model residuals и approximate two-sided null-bootstrap `p-value` по restricted model без treatment-step;
- uncertainty считается консервативно по всей идентифицированной lag-family: итоговый CI — envelope по lag 0/+1/+2, итоговый `p` — наиболее консервативный из lag-specific p-values;
- `UNCERTAINTY_IDENTIFIED / UNCERTAINTY_NOT_IDENTIFIED`;
- confidence interval, пересекающий ноль, блокирует сильное `DEPLOY/ROLLBACK`;
- campaign-wide **Benjamini–Hochberg** по доступным transition p-values;
- `qValue`, `FDR_PASS / FDR_NOT_PASS / FDR_NOT_APPLICABLE`;
- сильное `DEPLOY/ROLLBACK`, не прошедшее BH/FDR, понижается до `INCONCLUSIVE` с сохранением `decisionBeforeFdr`;
- UI показывает temporal status, lag-specific effects, bootstrap CI, `p`, `q`, FDR status и прежнее решение при FDR downgrade;
- MDE/power feasibility с empirical variance и Poisson variance floor для заказов;
- `DEPLOY / ROLLBACK / EXTEND / INCONCLUSIVE` как операционные observational-решения;
- `NO_FEASIBLE_TEST` при недостижимой мощности или неотделимом от CPC-шума шаге;
- полный next-test card: baseline, TargetCPC, corridor, separation, minimum days, primary KPI volume, maximum horizon, stabilization, stop-loss, mixed conditions, reload rule и possible decisions;
- локальный response evidence и ограничение дальней экстраполяции;
- локальный browser-only запуск без backend/npm runtime/CDN;
- статические, интеграционные и adversarial-тесты плюс CI guard против старого `logSpend`/day-to-day decision path.

## Temporal calibration — что именно считается

Для каждого `CLEAN_CPC_TRANSITION` приложение отдельно проверяет lag 0, +1 и +2 дня.

Для каждого lag строится локальная observational-модель на дневной primary KPI:

```text
primary KPI
~ regime/treatment indicator
+ linear calendar trend
+ weekday fixed effects
```

Первые `lag` дней нового CPC-regime исключаются из соответствующего lag-сценария. Если данных недостаточно или дизайн вырожден, числовой эффект не создаётся.

Результат:

- `LAG_STABLE` — направление эффекта между идентифицируемыми lag-сценариями согласовано и spread не превышает заданный guardrail;
- `LAG_SENSITIVE` — знак или величина существенно зависит от lag;
- `LAG_NOT_IDENTIFIED` — данных недостаточно для локальной weekday/trend-adjusted оценки.

Даже `LAG_STABLE` остаётся **наблюдательным**, а не причинно доказанным результатом.

## Bootstrap uncertainty и FDR — что именно считается

Для `LAG_STABLE` переходов строится moving-block residual bootstrap. Residual blocks ресемплируются отдельно внутри baseline и test regimes, чтобы не перемешивать временную структуру через CPC change-point.

Для каждого идентифицированного lag:

1. full temporal model используется для bootstrap distribution эффекта и percentile CI;
2. restricted temporal model без treatment-step задаёт null process для approximate two-sided bootstrap p-value;
3. residual blocks не центрируются искусственно по режимам — bootstrap сохраняет естественную вариативность групповых средних.

Поскольку lag 0/+1/+2 проверяются как семейство, uncertainty не рассчитывается только для одного удобного lag. Итоговый CI расширяется до **консервативной оболочки** всех идентифицированных lag-specific CI, а итоговый p-value берётся как максимальный lag-specific p-value.

После анализа всех SKU в загруженной рекламной кампании доступные transition p-values образуют одно семейство для Benjamini–Hochberg. В UI показываются `p`, `q` и FDR status.

Важно:

> `p` и `q` повышают или понижают устойчивость observational evidence, но не доказывают причинность CPC-эффекта.

### Осознанно отложено и не должно трактоваться как реализованное

1. **Более богатая сезонная/календарная модель (§11, §16).** Сейчас реализованы weekday fixed effects и линейный trend. Праздники, нелинейная сезонность, внешние demand indices и более сложная interrupted-time-series структура пока не моделируются.
2. **Monte-Carlo calibration (§21).** Block bootstrap реализован, но отдельная широкая симуляционная калибровка false-positive rate, sign recovery и empirical CI coverage на сетке DGP ещё не выполнена. До неё bootstrap p/q следует воспринимать как дополнительный observational safeguard, а не как идеально откалиброванный causal test.
3. **Confidence score (§31).** Числовой `Confidence 0–100` намеренно не показывается, пока score не откалиброван; это лучше, чем создать ложную вероятность истины.
4. **Полная contribution-profit экономика (§15).** Сейчас поддерживаются упрощённые входы `unitContributionBeforeAds` или `contributionMarginRate`. Полный разбор COGS, marketplace fees, logistics, taxes, buyout/returns/compensations требует дополнительных входных данных и остаётся следующим слоем.
5. **Гладкая нелинейная response curve и математический `CPC*` (§27–29).** Сейчас используются наблюдаемые локальные response points и следующий ограниченный TargetCPC. Далёкая экстраполяция запрещена; полноценный smooth optimum не заявляется.
6. **Heterogeneity по budget regimes (§28).** Отдельные CPC-кривые по бюджетным состояниям не строятся до появления достаточного evidence, как и требует спецификация.
7. **Полное разделение UI-меток `OBSERVED / ESTIMATED / INFERRED / RECOMMENDED` (§30).** Ключевые `OBSERVATIONAL`, budget-state, temporal source, uncertainty/FDR и recommendation labels уже разделены, но полный semantic tagging каждого показателя ещё требует отдельного UI-прохода.

Эти пункты являются **следующими калибровочными/экономическими фазами**, а не скрытыми возможностями текущей версии.

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
- `docs/superpowers/plans/2026-08-28-v2-statistical-calibration.md`
- `docs/superpowers/plans/2026-08-28-v2-uncertainty-calibration.md`

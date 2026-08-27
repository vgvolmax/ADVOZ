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
→ response curve
→ TargetCPC + карточка следующего теста
  или NO_FEASIBLE_TEST
```

Все выводы из исторических переходов маркируются как **`OBSERVATIONAL`**. `DEPLOY` / `ROLLBACK` — операционные рекомендации по наблюдательному evidence, а не утверждение о причинно доказанном эффекте.

## Ключевые ограничения модели

- `Spend` не используется как control в regression полного эффекта CPC.
- `Spend ≈ CPC × Clicks` используется только как data-quality check.
- точный установленный недельный бюджет и Coverage не восстанавливаются;
- rolling-7d Spend используется только для вывода эффективного бюджетного состояния;
- при неоднозначности используется `BUDGET_STATE_UNCERTAIN` / `INCONCLUSIVE`;
- следующий тест не рекомендуется, если он не отделим от CPC-шума или нужная мощность недостижима за разумный срок (`NO_FEASIBLE_TEST`).

Полная утверждённая математическая спецификация: [`Ozon_CPC_Optimizer_v2_FINAL_SPEC.md`](Ozon_CPC_Optimizer_v2_FINAL_SPEC.md).

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

CI дополнительно запрещает попадание старого spend-adjusted/day-to-day decision path (`logSpend`, `fitDifferencedElasticity`, `marginalCpo`) в `src/`, `app.js` или `index.html`.

## Архитектурные документы

- `docs/superpowers/specs/2026-08-27-advoz-v2-architecture-design.md`
- `docs/superpowers/plans/2026-08-27-advoz-v2-implementation.md`

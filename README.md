Инструкция по установке (всё ставим в default namespace):

1. В папке db заводим секрет для пароля: _kubectl apply -f 00-secret.yaml_
2. Затем ставим PostgreSQL с параметрами:_ helm install postgresql bitnami/postgresql -f values.yaml_
3. По желанию, делаем миграцию БД: _kubectl apply -f 01-migration.yaml_
4. Выходим в корень репозитория и применяем все манифесты (конфиг, деплой, сервисы, ингресс): _kubectl apply -f ._

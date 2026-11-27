# Matriz de permisos

| Endpoint | Rol requerido |
|---|---|
| `GET /m/<id>/` (página inicial) | lector |
| `GET /m/<id>/api/v1/yo` | lector |
| `GET /m/<id>/api/v1/notas` | lector |
| `POST /m/<id>/api/v1/notas` | operador |
| `DELETE /m/<id>/api/v1/notas/:id` | administrador |

Los roles se declaran en `modulo.yaml`; la asignación a personas la hace Sistemas en la plataforma.
Los roles no se heredan entre sí: quien administra y carga necesita ambos roles.
Es una decisión de la plataforma (ADR 0016 de `plataforma`): los roles son explícitos, sin jerarquía. El acceso de una persona es exactamente la lista de roles que tiene asignados, así que cada endpoint declara el **rol requerido**, no un "rol mínimo".

Todas las rutas de la API tienen límite de pedidos por usuario (`RATE_LIMIT_POR_MINUTO`, 120 por defecto).

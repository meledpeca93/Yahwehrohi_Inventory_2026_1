# Formato CSV para cargar pedidos en facturacion

El sistema acepta archivos `.csv` separados por coma, punto y coma o tabulador.

Formato recomendado:

```csv
Cliente,Metodo de Pago,Producto,Cantidad,Precio Unitario (L),Subtotal (L),Fecha
"Melvin Pena","Transferencia Bancaria","Frijoles Rojos Seleccionados 2 lb",2,48.00,96.00,"2026-08-18 23:03:19"
"Melvin Pena","Transferencia Bancaria","Aceite Vegetal Cocina 800ml",3,52.00,156.00,"2026-08-18 23:03:19"
"Melvin Pena","Transferencia Bancaria","Arroz Blanco Clasificado 5 lb",1,65.00,65.00,"2026-08-18 23:03:19"
,,,,TOTAL:,317.00,"2026-08-18 23:03:19"
```

Columnas usadas por el sistema:

- `Cliente`: nombre del cliente. Si coincide con un cliente existente, se selecciona automaticamente.
- `Metodo de Pago`: acepta efectivo, transferencia o credito.
- `Producto`: nombre del producto tal como existe en inventario.
- `Cantidad`: cantidad solicitada.
- `Precio Unitario (L)`: precio que se cargara en la linea de venta. Si falta, se usa el precio actual del inventario.

Columnas opcionales compatibles:

- `SKU`, `Codigo`, `Codigo de barra`, `ID Producto`: permiten buscar el producto por codigo en vez de solo por nombre.
- `Subtotal (L)`: se puede incluir para control de la web, pero el sistema recalcula el total.
- `Fecha`: se conserva como referencia del archivo, pero la factura usa la fecha de emision del sistema.

Notas:

- La fila `TOTAL` es opcional y se ignora al importar.
- El nombre del producto debe coincidir con inventario. Tambien se acepta coincidencia parcial si el nombre es suficientemente claro.
- Si una linea supera el stock disponible, esa linea no se carga y el sistema muestra el aviso.

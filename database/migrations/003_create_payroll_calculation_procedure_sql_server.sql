USE yahweh_rohi_inventory;
GO

/*
  PROCEDIMIENTO: dbo.sp_calcular_planilla_desde_asistencia

  QUE HACE:
  1. TOMA LA ASISTENCIA DIARIA DESDE dbo.ASISTENCIA.
  2. CALCULA HORAS NORMALES, HORAS EXTRA 1 Y HORAS EXTRA 3 POR DIA.
  3. AGRUPA LOS TOTALES POR SEMANA Y EMPLEADO.
  4. DEVUELVE DOS RESULTADOS:
     - DETALLE DIARIO
     - RESUMEN SEMANAL POR USUARIO

  REGLAS IMPLEMENTADAS:
  - LUNES A JUEVES Y VIERNES:
      08:00 - 16:00 = HORA NORMAL  @ 15
      16:00 - 20:00 = HORA EXTRA 1 @ 20
      20:00 - 22:00 = HORA EXTRA 3 @ 25
  - SABADO:
      08:00 - 12:00 = HORA NORMAL  @ 15
      12:00 - 22:00 = HORA EXTRA 3 @ 30
  - DOMINGO:
      TODAS LAS HORAS TRABAJADAS DEL DIA = HORA EXTRA 3 @ 30

  SUPUESTO:
  - COMO EN EL REQUERIMIENTO NO SE DEFINIO EL VIERNES POR SEPARADO,
    SE ESTA CALCULANDO IGUAL QUE LUNES A JUEVES.
*/

CREATE OR ALTER PROCEDURE dbo.sp_calcular_planilla_desde_asistencia
  @fecha_inicio DATE = NULL,
  @fecha_fin DATE = NULL,
  @num_semana INT = NULL,
  @anio INT = NULL,
  @id_empleado INT = NULL
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @tarifa_hora_normal DECIMAL(10, 2) = 15.00;
  DECLARE @tarifa_hora_extra_1 DECIMAL(10, 2) = 20.00;
  DECLARE @tarifa_hora_extra_3_laboral DECIMAL(10, 2) = 25.00;
  DECLARE @tarifa_hora_extra_3_fin_semana DECIMAL(10, 2) = 30.00;

  IF @anio IS NULL
  BEGIN
    SET @anio = YEAR(ISNULL(@fecha_inicio, GETDATE()));
  END;

  IF @fecha_inicio IS NULL AND @fecha_fin IS NULL AND @num_semana IS NOT NULL
  BEGIN
    DECLARE @fecha_iso_referencia DATE = DATEFROMPARTS(@anio, 1, 4);
    DECLARE @desplazamiento_inicio INT = (DATEDIFF(DAY, '19000101', @fecha_iso_referencia) % 7 + 7) % 7;
    DECLARE @primer_lunes DATE = DATEADD(DAY, -@desplazamiento_inicio, @fecha_iso_referencia);

    SET @fecha_inicio = DATEADD(DAY, (@num_semana - 1) * 7, @primer_lunes);
    SET @fecha_fin = DATEADD(DAY, 6, @fecha_inicio);
  END;

  IF @fecha_inicio IS NULL
  BEGIN
    SET @fecha_inicio = DATEADD(DAY, -6, CAST(GETDATE() AS DATE));
  END;

  IF @fecha_fin IS NULL
  BEGIN
    SET @fecha_fin = @fecha_inicio;
  END;

  ;WITH asistencia_filtrada AS (
    SELECT
      a.ID_ASISTENCIA,
      a.ID_EMPLEADO,
      CAST(TRY_CONVERT(date, a.FECHA) AS date) AS FECHA_ASISTENCIA,
      TRY_CONVERT(datetime, a.HORA_ENTRADA) AS HORA_ENTRADA,
      TRY_CONVERT(datetime, a.HORA_SALIDA) AS HORA_SALIDA,
      ISNULL(a.num_semana, DATEPART(ISO_WEEK, TRY_CONVERT(date, a.FECHA))) AS NUM_SEMANA,
      ROW_NUMBER() OVER (
        PARTITION BY a.ID_EMPLEADO, TRY_CONVERT(date, a.FECHA)
        ORDER BY a.ID_ASISTENCIA DESC
      ) AS rn
    FROM dbo.ASISTENCIA a
    WHERE TRY_CONVERT(date, a.FECHA) BETWEEN @fecha_inicio AND @fecha_fin
      AND (@id_empleado IS NULL OR a.ID_EMPLEADO = @id_empleado)
  ),
  asistencia_base AS (
    SELECT
      af.ID_EMPLEADO,
      af.FECHA_ASISTENCIA,
      af.HORA_ENTRADA,
      af.HORA_SALIDA,
      af.NUM_SEMANA,
      ((DATEDIFF(DAY, '19000101', af.FECHA_ASISTENCIA) % 7 + 7) % 7) + 1 AS DIA_SEMANA
    FROM asistencia_filtrada af
    WHERE af.rn = 1
      AND af.FECHA_ASISTENCIA IS NOT NULL
      AND af.HORA_ENTRADA IS NOT NULL
      AND af.HORA_SALIDA IS NOT NULL
      AND af.HORA_SALIDA > af.HORA_ENTRADA
  ),
  cortes AS (
    SELECT
      ab.ID_EMPLEADO,
      ab.FECHA_ASISTENCIA,
      ab.NUM_SEMANA,
      ab.DIA_SEMANA,
      ab.HORA_ENTRADA,
      ab.HORA_SALIDA,
      CAST(
        CASE
          WHEN ab.DIA_SEMANA BETWEEN 1 AND 5 THEN
            CASE
              WHEN DATEDIFF(
                     MINUTE,
                     CASE WHEN ab.HORA_ENTRADA > DATEADD(HOUR, 8, CAST(ab.FECHA_ASISTENCIA AS datetime))
                          THEN ab.HORA_ENTRADA
                          ELSE DATEADD(HOUR, 8, CAST(ab.FECHA_ASISTENCIA AS datetime))
                     END,
                     CASE WHEN ab.HORA_SALIDA < DATEADD(HOUR, 16, CAST(ab.FECHA_ASISTENCIA AS datetime))
                          THEN ab.HORA_SALIDA
                          ELSE DATEADD(HOUR, 16, CAST(ab.FECHA_ASISTENCIA AS datetime))
                     END
                   ) > 0
                THEN DATEDIFF(
                       MINUTE,
                       CASE WHEN ab.HORA_ENTRADA > DATEADD(HOUR, 8, CAST(ab.FECHA_ASISTENCIA AS datetime))
                            THEN ab.HORA_ENTRADA
                            ELSE DATEADD(HOUR, 8, CAST(ab.FECHA_ASISTENCIA AS datetime))
                       END,
                       CASE WHEN ab.HORA_SALIDA < DATEADD(HOUR, 16, CAST(ab.FECHA_ASISTENCIA AS datetime))
                            THEN ab.HORA_SALIDA
                            ELSE DATEADD(HOUR, 16, CAST(ab.FECHA_ASISTENCIA AS datetime))
                       END
                     )
              ELSE 0
            END
          WHEN ab.DIA_SEMANA = 6 THEN
            CASE
              WHEN DATEDIFF(
                     MINUTE,
                     CASE WHEN ab.HORA_ENTRADA > DATEADD(HOUR, 8, CAST(ab.FECHA_ASISTENCIA AS datetime))
                          THEN ab.HORA_ENTRADA
                          ELSE DATEADD(HOUR, 8, CAST(ab.FECHA_ASISTENCIA AS datetime))
                     END,
                     CASE WHEN ab.HORA_SALIDA < DATEADD(HOUR, 12, CAST(ab.FECHA_ASISTENCIA AS datetime))
                          THEN ab.HORA_SALIDA
                          ELSE DATEADD(HOUR, 12, CAST(ab.FECHA_ASISTENCIA AS datetime))
                     END
                   ) > 0
                THEN DATEDIFF(
                       MINUTE,
                       CASE WHEN ab.HORA_ENTRADA > DATEADD(HOUR, 8, CAST(ab.FECHA_ASISTENCIA AS datetime))
                            THEN ab.HORA_ENTRADA
                            ELSE DATEADD(HOUR, 8, CAST(ab.FECHA_ASISTENCIA AS datetime))
                       END,
                       CASE WHEN ab.HORA_SALIDA < DATEADD(HOUR, 12, CAST(ab.FECHA_ASISTENCIA AS datetime))
                            THEN ab.HORA_SALIDA
                            ELSE DATEADD(HOUR, 12, CAST(ab.FECHA_ASISTENCIA AS datetime))
                       END
                     )
              ELSE 0
            END
          ELSE 0
        END AS decimal(18, 2)
      ) AS MINUTOS_HORA_NORMAL,
      CAST(
        CASE
          WHEN ab.DIA_SEMANA BETWEEN 1 AND 5 THEN
            CASE
              WHEN DATEDIFF(
                     MINUTE,
                     CASE WHEN ab.HORA_ENTRADA > DATEADD(HOUR, 16, CAST(ab.FECHA_ASISTENCIA AS datetime))
                          THEN ab.HORA_ENTRADA
                          ELSE DATEADD(HOUR, 16, CAST(ab.FECHA_ASISTENCIA AS datetime))
                     END,
                     CASE WHEN ab.HORA_SALIDA < DATEADD(HOUR, 20, CAST(ab.FECHA_ASISTENCIA AS datetime))
                          THEN ab.HORA_SALIDA
                          ELSE DATEADD(HOUR, 20, CAST(ab.FECHA_ASISTENCIA AS datetime))
                     END
                   ) > 0
                THEN DATEDIFF(
                       MINUTE,
                       CASE WHEN ab.HORA_ENTRADA > DATEADD(HOUR, 16, CAST(ab.FECHA_ASISTENCIA AS datetime))
                            THEN ab.HORA_ENTRADA
                            ELSE DATEADD(HOUR, 16, CAST(ab.FECHA_ASISTENCIA AS datetime))
                       END,
                       CASE WHEN ab.HORA_SALIDA < DATEADD(HOUR, 20, CAST(ab.FECHA_ASISTENCIA AS datetime))
                            THEN ab.HORA_SALIDA
                            ELSE DATEADD(HOUR, 20, CAST(ab.FECHA_ASISTENCIA AS datetime))
                       END
                     )
              ELSE 0
            END
          ELSE 0
        END AS decimal(18, 2)
      ) AS MINUTOS_HORA_EXTRA_1,
      CAST(
        CASE
          WHEN ab.DIA_SEMANA BETWEEN 1 AND 5 THEN
            CASE
              WHEN DATEDIFF(
                     MINUTE,
                     CASE WHEN ab.HORA_ENTRADA > DATEADD(HOUR, 20, CAST(ab.FECHA_ASISTENCIA AS datetime))
                          THEN ab.HORA_ENTRADA
                          ELSE DATEADD(HOUR, 20, CAST(ab.FECHA_ASISTENCIA AS datetime))
                     END,
                     CASE WHEN ab.HORA_SALIDA < DATEADD(HOUR, 22, CAST(ab.FECHA_ASISTENCIA AS datetime))
                          THEN ab.HORA_SALIDA
                          ELSE DATEADD(HOUR, 22, CAST(ab.FECHA_ASISTENCIA AS datetime))
                     END
                   ) > 0
                THEN DATEDIFF(
                       MINUTE,
                       CASE WHEN ab.HORA_ENTRADA > DATEADD(HOUR, 20, CAST(ab.FECHA_ASISTENCIA AS datetime))
                            THEN ab.HORA_ENTRADA
                            ELSE DATEADD(HOUR, 20, CAST(ab.FECHA_ASISTENCIA AS datetime))
                       END,
                       CASE WHEN ab.HORA_SALIDA < DATEADD(HOUR, 22, CAST(ab.FECHA_ASISTENCIA AS datetime))
                            THEN ab.HORA_SALIDA
                            ELSE DATEADD(HOUR, 22, CAST(ab.FECHA_ASISTENCIA AS datetime))
                       END
                     )
              ELSE 0
            END
          WHEN ab.DIA_SEMANA = 6 THEN
            CASE
              WHEN DATEDIFF(
                     MINUTE,
                     CASE WHEN ab.HORA_ENTRADA > DATEADD(HOUR, 12, CAST(ab.FECHA_ASISTENCIA AS datetime))
                          THEN ab.HORA_ENTRADA
                          ELSE DATEADD(HOUR, 12, CAST(ab.FECHA_ASISTENCIA AS datetime))
                     END,
                     CASE WHEN ab.HORA_SALIDA < DATEADD(HOUR, 22, CAST(ab.FECHA_ASISTENCIA AS datetime))
                          THEN ab.HORA_SALIDA
                          ELSE DATEADD(HOUR, 22, CAST(ab.FECHA_ASISTENCIA AS datetime))
                     END
                   ) > 0
                THEN DATEDIFF(
                       MINUTE,
                       CASE WHEN ab.HORA_ENTRADA > DATEADD(HOUR, 12, CAST(ab.FECHA_ASISTENCIA AS datetime))
                            THEN ab.HORA_ENTRADA
                            ELSE DATEADD(HOUR, 12, CAST(ab.FECHA_ASISTENCIA AS datetime))
                       END,
                       CASE WHEN ab.HORA_SALIDA < DATEADD(HOUR, 22, CAST(ab.FECHA_ASISTENCIA AS datetime))
                            THEN ab.HORA_SALIDA
                            ELSE DATEADD(HOUR, 22, CAST(ab.FECHA_ASISTENCIA AS datetime))
                       END
                     )
              ELSE 0
            END
          WHEN ab.DIA_SEMANA = 7 THEN DATEDIFF(MINUTE, ab.HORA_ENTRADA, ab.HORA_SALIDA)
          ELSE 0
        END AS decimal(18, 2)
      ) AS MINUTOS_HORA_EXTRA_3
    FROM asistencia_base ab
  ),
  calculo_diario AS (
    SELECT
      c.ID_EMPLEADO,
      u.nombre,
      u.usuario,
      u.rol,
      c.FECHA_ASISTENCIA,
      c.NUM_SEMANA,
      YEAR(c.FECHA_ASISTENCIA) AS ANIO,
      c.DIA_SEMANA,
      CASE c.DIA_SEMANA
        WHEN 1 THEN 'LUNES'
        WHEN 2 THEN 'MARTES'
        WHEN 3 THEN 'MIERCOLES'
        WHEN 4 THEN 'JUEVES'
        WHEN 5 THEN 'VIERNES'
        WHEN 6 THEN 'SABADO'
        WHEN 7 THEN 'DOMINGO'
      END AS DIA_NOMBRE,
      CAST(c.MINUTOS_HORA_NORMAL / 60.0 AS decimal(18, 2)) AS HORAS_NORMALES,
      CAST(c.MINUTOS_HORA_EXTRA_1 / 60.0 AS decimal(18, 2)) AS HORAS_EXTRA_1,
      CAST(c.MINUTOS_HORA_EXTRA_3 / 60.0 AS decimal(18, 2)) AS HORAS_EXTRA_3,
      @tarifa_hora_normal AS TARIFA_HORA_NORMAL,
      @tarifa_hora_extra_1 AS TARIFA_HORA_EXTRA_1,
      CASE
        WHEN c.DIA_SEMANA IN (6, 7) THEN @tarifa_hora_extra_3_fin_semana
        ELSE @tarifa_hora_extra_3_laboral
      END AS TARIFA_HORA_EXTRA_3,
      CAST((c.MINUTOS_HORA_NORMAL / 60.0) * @tarifa_hora_normal AS decimal(18, 2)) AS PAGO_HORAS_NORMALES,
      CAST((c.MINUTOS_HORA_EXTRA_1 / 60.0) * @tarifa_hora_extra_1 AS decimal(18, 2)) AS PAGO_HORAS_EXTRA_1,
      CAST(
        (c.MINUTOS_HORA_EXTRA_3 / 60.0) *
        CASE
          WHEN c.DIA_SEMANA IN (6, 7) THEN @tarifa_hora_extra_3_fin_semana
          ELSE @tarifa_hora_extra_3_laboral
        END
        AS decimal(18, 2)
      ) AS PAGO_HORAS_EXTRA_3
    FROM cortes c
    INNER JOIN dbo.usuario u
      ON u.id_usuario = c.ID_EMPLEADO
    WHERE u.activo = 1
  )
  SELECT
    ID_EMPLEADO,
    nombre,
    usuario,
    rol,
    FECHA_ASISTENCIA,
    ANIO,
    NUM_SEMANA,
    DIA_SEMANA,
    DIA_NOMBRE,
    HORAS_NORMALES,
    HORAS_EXTRA_1,
    HORAS_EXTRA_3,
    TARIFA_HORA_NORMAL,
    TARIFA_HORA_EXTRA_1,
    TARIFA_HORA_EXTRA_3,
    PAGO_HORAS_NORMALES,
    PAGO_HORAS_EXTRA_1,
    PAGO_HORAS_EXTRA_3,
    CAST(HORAS_NORMALES + HORAS_EXTRA_1 + HORAS_EXTRA_3 AS decimal(18, 2)) AS TOTAL_HORAS_DIA,
    CAST(PAGO_HORAS_NORMALES + PAGO_HORAS_EXTRA_1 + PAGO_HORAS_EXTRA_3 AS decimal(18, 2)) AS TOTAL_PAGO_DIA
  FROM calculo_diario
  ORDER BY nombre ASC, FECHA_ASISTENCIA ASC;

  SELECT
    ID_EMPLEADO,
    nombre,
    usuario,
    rol,
    ANIO,
    NUM_SEMANA,
    CAST(SUM(HORAS_NORMALES) AS decimal(18, 2)) AS HORAS_NORMALES_SEMANA,
    CAST(SUM(HORAS_EXTRA_1) AS decimal(18, 2)) AS HORAS_EXTRA_1_SEMANA,
    CAST(SUM(HORAS_EXTRA_3) AS decimal(18, 2)) AS HORAS_EXTRA_3_SEMANA,
    CAST(SUM(PAGO_HORAS_NORMALES) AS decimal(18, 2)) AS PAGO_HORAS_NORMALES_SEMANA,
    CAST(SUM(PAGO_HORAS_EXTRA_1) AS decimal(18, 2)) AS PAGO_HORAS_EXTRA_1_SEMANA,
    CAST(SUM(PAGO_HORAS_EXTRA_3) AS decimal(18, 2)) AS PAGO_HORAS_EXTRA_3_SEMANA,
    CAST(SUM(HORAS_NORMALES + HORAS_EXTRA_1 + HORAS_EXTRA_3) AS decimal(18, 2)) AS TOTAL_HORAS_SEMANA,
    CAST(SUM(PAGO_HORAS_NORMALES + PAGO_HORAS_EXTRA_1 + PAGO_HORAS_EXTRA_3) AS decimal(18, 2)) AS SALARIO_SEMANAL
  FROM calculo_diario
  GROUP BY
    ID_EMPLEADO,
    nombre,
    usuario,
    rol,
    ANIO,
    NUM_SEMANA
  ORDER BY nombre ASC, ANIO ASC, NUM_SEMANA ASC;
END;
GO

/*
  EJEMPLOS DE USO

  1. CALCULAR UNA SEMANA ISO ESPECIFICA:
     EXEC dbo.sp_calcular_planilla_desde_asistencia
       @num_semana = 16,
       @anio = 2026;

  2. CALCULAR UN RANGO DE FECHAS:
     EXEC dbo.sp_calcular_planilla_desde_asistencia
       @fecha_inicio = '2026-04-13',
       @fecha_fin = '2026-04-19';

  3. CALCULAR SOLO UN EMPLEADO:
     EXEC dbo.sp_calcular_planilla_desde_asistencia
       @fecha_inicio = '2026-04-13',
       @fecha_fin = '2026-04-19',
       @id_empleado = 5;
*/

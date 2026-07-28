-- 1. Bobin / Üretim Bilgisi
CREATE TABLE coils (
    coil_id VARCHAR(50) PRIMARY KEY, -- Örn: BOBIN-2026-9041
    steel_grade VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- 2. Şikayet / Kusur Kaydı
CREATE TABLE defects (
    defect_id SERIAL PRIMARY KEY,
    coil_id VARCHAR(50) REFERENCES coils(coil_id) ON DELETE CASCADE,
    defect_code VARCHAR(50) NOT NULL, -- Örn: DEF_EDGE
    status VARCHAR(30) DEFAULT 'ANALYZING'
);
-- 3. Üretim Hattı Aşamaları (Çelikhane, Sıcak Hadde, Asitleme, Soğuk Hadde)
CREATE TABLE process_stages (
    stage_id SERIAL PRIMARY KEY,
    coil_id VARCHAR(50) REFERENCES coils(coil_id) ON DELETE CASCADE,
    stage_name VARCHAR(100) NOT NULL,
    stage_order INT NOT NULL,
    status VARCHAR(20) NOT NULL,     -- 'OK' veya 'ANOMALI'
    sensor_count INT DEFAULT 4
);

-- 4. Sensör Anlık Verileri (0 - 180 saniye arası zaman serisi)
CREATE TABLE sensor_readings (
    reading_id BIGSERIAL PRIMARY KEY,
    coil_id VARCHAR(50) REFERENCES coils(coil_id) ON DELETE CASCADE,
    stage_name VARCHAR(100) NOT NULL,
    sensor_key VARCHAR(50) NOT NULL,  -- DESCALER_PRESSURE, STRIP_TEMP, ROLL_FORCE, SPEED
    time_second INT NOT NULL,          -- 0 - 180
    actual_value NUMERIC(8,2) NOT NULL,
    target_value NUMERIC(8,2) NOT NULL,
    min_limit NUMERIC(8,2),
    max_limit NUMERIC(8,2)
);

-- 5. Kök Neden Analiz Sonuçları ve Teşhis
CREATE TABLE root_cause_results (
    result_id SERIAL PRIMARY KEY,
    coil_id VARCHAR(50) REFERENCES coils(coil_id) ON DELETE CASCADE,
    equipment VARCHAR(100) NOT NULL,            -- DESCALER_NOZZLE_02
    fault_source VARCHAR(255) NOT NULL,         -- Nozul tıkanıklığı veya valf sızıntısı
    detection_detail TEXT NOT NULL,             -- Descaler basıncı 180 Bar hedefine karşı 142.5 Bar ölçüldü (%20.8 sapma).
    confidence_rate NUMERIC(5,2) NOT NULL,     -- 86.4
    production_impact_pct INT NOT NULL,         -- 91
    logistic_impact_pct INT NOT NULL,           -- 6
    recommended_action TEXT NOT NULL
);

-- ==============================================================================
-- 1. YENİ BOBİN: BOBIN-2026-9042 (Kusur: ASİTLEME / Leke ve Asit Kalıntısı)
-- ==============================================================================
INSERT INTO coils (coil_id, steel_grade) VALUES ('BOBIN-2026-9042', 'S235JR');

INSERT INTO defects (coil_id, defect_code, status) VALUES ('BOBIN-2026-9042', 'DEF_ACID_STAIN', 'COMPLETED');

INSERT INTO process_stages (coil_id, stage_name, stage_order, status, sensor_count) VALUES
('BOBIN-2026-9042', 'Çelikhane', 1, 'OK', 4),
('BOBIN-2026-9042', 'Sıcak Haddehane', 2, 'OK', 4),
('BOBIN-2026-9042', 'Asitleme', 3, 'ANOMALI', 4),
('BOBIN-2026-9042', 'Soğuk Haddehane', 4, 'OK', 4);

INSERT INTO root_cause_results (
    coil_id, equipment, fault_source, detection_detail, 
    confidence_rate, production_impact_pct, logistic_impact_pct, recommended_action
) VALUES (
    'BOBIN-2026-9042',
    'PICKLING_TANK_02',
    'Banyo sıcaklığı düşüklüğü ve asit konsantrasyon sapması',
    'Banyo sıcaklığı 72 °C hedefine karşı 58.2 °C ölçüldü (%19.1 sapma).',
    92.1, 95, 3,
    'Asitleme tankı rejenere ısıtıcı eşanjörünü kontrol edin, asit dozaj vanasını kalibre edin.'
);

INSERT INTO sensor_readings (coil_id, stage_name, sensor_key, time_second, actual_value, target_value, min_limit, max_limit) VALUES
('BOBIN-2026-9042', 'Asitleme', 'Asit Konsantrasyonu', 180, 125.10, 160.00, 131.20, 188.80), -- Sapma
('BOBIN-2026-9042', 'Asitleme', 'Banyo Sıcaklığı', 180, 58.20, 72.00, 62.60, 81.40),       -- ANOMALİ
('BOBIN-2026-9042', 'Asitleme', 'Soğutma Debisi', 180, 418.00, 420.00, 357.00, 483.00),
('BOBIN-2026-9042', 'Asitleme', 'Şerit Geçiş Hızı', 180, 94.80, 95.00, 77.90, 112.10);


-- ==============================================================================
-- 2. YENİ BOBİN: BOBIN-2026-9043 (Kusur: SOĞUK HADDEHANE / Kalınlık Sapması)
-- ==============================================================================
INSERT INTO coils (coil_id, steel_grade) VALUES ('BOBIN-2026-9043', 'DC01');

INSERT INTO defects (coil_id, defect_code, status) VALUES ('BOBIN-2026-9043', 'DEF_THICKNESS', 'COMPLETED');

INSERT INTO process_stages (coil_id, stage_name, stage_order, status, sensor_count) VALUES
('BOBIN-2026-9043', 'Çelikhane', 1, 'OK', 4),
('BOBIN-2026-9043', 'Sıcak Haddehane', 2, 'OK', 4),
('BOBIN-2026-9043', 'Asitleme', 3, 'OK', 4),
('BOBIN-2026-9043', 'Soğuk Haddehane', 4, 'ANOMALI', 4);

INSERT INTO root_cause_results (
    coil_id, equipment, fault_source, detection_detail, 
    confidence_rate, production_impact_pct, logistic_impact_pct, recommended_action
) VALUES (
    'BOBIN-2026-9043',
    'TANDEM_ROLL_STAND_03',
    'Merdane hidrolik baskı silindirinde aşırı kuvvet kaybı',
    'Merdane kuvveti 9.0 kN hedefine karşı 12.45 kN ölçüldü (%38.3 yüksek sapma).',
    89.7, 88, 8,
    'Tandem 3. stant merdane açıklık (gap) hidroliğini ve Servo valf basıncını denetleyin.'
);

INSERT INTO sensor_readings (coil_id, stage_name, sensor_key, time_second, actual_value, target_value, min_limit, max_limit) VALUES
('BOBIN-2026-9043', 'Soğuk Haddehane', 'Merdane Kuvveti', 180, 12.45, 9.00, 7.20, 10.80),    -- ANOMALİ
('BOBIN-2026-9043', 'Soğuk Haddehane', 'Şerit Gerginliği', 180, 10.20, 14.00, 11.50, 16.50),  -- Sapma
('BOBIN-2026-9043', 'Soğuk Haddehane', 'Rulman Sıcaklığı', 180, 64.10, 55.00, 47.90, 62.10),  -- Sapma
('BOBIN-2026-9043', 'Soğuk Haddehane', 'Emülsiyon Debisi', 180, 278.50, 280.00, 229.60, 330.40);


-- ==============================================================================
-- 3. YENİ BOBİN: BOBIN-2026-9044 (Kusur: ÇELİKHANE / Gözenek - Porozite)
-- ==============================================================================
INSERT INTO coils (coil_id, steel_grade) VALUES ('BOBIN-2026-9044', 'DX54D');

INSERT INTO defects (coil_id, defect_code, status) VALUES ('BOBIN-2026-9044', 'DEF_POROSITY', 'COMPLETED');

INSERT INTO process_stages (coil_id, stage_name, stage_order, status, sensor_count) VALUES
('BOBIN-2026-9044', 'Çelikhane', 1, 'ANOMALI', 4),
('BOBIN-2026-9044', 'Sıcak Haddehane', 2, 'OK', 4),
('BOBIN-2026-9044', 'Asitleme', 3, 'OK', 4),
('BOBIN-2026-9044', 'Soğuk Haddehane', 4, 'OK', 4);

INSERT INTO root_cause_results (
    coil_id, equipment, fault_source, detection_detail, 
    confidence_rate, production_impact_pct, logistic_impact_pct, recommended_action
) VALUES (
    'BOBIN-2026-9044',
    'OXYGEN_LANCE_01',
    'Oksijen üfleme lansında aşırı akış ve cüruf reaksiyon tutarsızlığı',
    'Oksijen üfleme debisi 3200 Nm³/h hedefine karşı 3810.5 Nm³/h ölçüldü (%19.0 yüksek sapma).',
    94.5, 96, 2,
    'Oksijen lans debi kontrol vanasını ve argon gaz karıştırma püskürtücülerini temizleyin.'
);

INSERT INTO sensor_readings (coil_id, stage_name, sensor_key, time_second, actual_value, target_value, min_limit, max_limit) VALUES
('BOBIN-2026-9044', 'Çelikhane', 'Fırın Sıcaklığı', 180, 1148.00, 1150.00, 1035.00, 1265.00),
('BOBIN-2026-9044', 'Çelikhane', 'Oksijen Üfleme Debisi', 180, 3810.50, 3200.00, 2720.00, 3680.00), -- ANOMALİ
('BOBIN-2026-9044', 'Çelikhane', 'Ergitme Akımı', 180, 48.05, 48.00, 42.20, 53.80),
('BOBIN-2026-9044', 'Çelikhane', 'Cüruf Bazikliği', 180, 2.15, 2.80, 2.30, 3.30);                  -- Sapma


SELECT c.coil_id, d.defect_code, ps.stage_name AS anomali_tesis 
FROM coils c
JOIN defects d ON c.coil_id = d.coil_id
JOIN process_stages ps ON c.coil_id = ps.coil_id
WHERE ps.status = 'ANOMALI';

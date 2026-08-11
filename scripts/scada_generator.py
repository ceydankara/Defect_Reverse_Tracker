import math
import random
import psycopg2

# 1. VERİTABANI BAĞLANTI AYARLARI
DB_CONFIG = {
    "dbname": "Defect Reverse-Tracker",
    "user": "postgres",
    "password": "***", 
    "host": "localhost",
    "port": "5432"
}

# 2. SENSÖR TANIMLARI VE BİREBİR UYUMLU İSİMLERİ (Her aşamada 4 kritik sensör)
SENSORS = [
    # Çelikhane
    {"name": "Fırın Sıcaklığı", "stage": "Çelikhane", "target": 1150, "unit": "°C", "type": "temp"},
    {"name": "Pota Sıcaklığı", "stage": "Çelikhane", "target": 1580, "unit": "°C", "type": "temp"},
    {"name": "Argon Akış Debisi", "stage": "Çelikhane", "target": 450, "unit": "L/dk", "type": "flow"},
    {"name": "Cüruf Kalınlığı", "stage": "Çelikhane", "target": 12, "unit": "mm", "type": "flow"},

    # Sıcak Haddehane
    {"name": "Hadde Merdane Sıcaklığı", "stage": "Sıcak Haddehane", "target": 880, "unit": "°C", "type": "temp"},
    {"name": "Şerit Çıkış Hızı", "stage": "Sıcak Haddehane", "target": 15, "unit": "m/s", "type": "pressure"},
    {"name": "Rulman Titreşimi", "stage": "Sıcak Haddehane", "target": 2.4, "unit": "mm/s", "type": "vibration"},
    {"name": "Emülsiyon Basıncı", "stage": "Sıcak Haddehane", "target": 6.5, "unit": "bar", "type": "pressure"},

    # Asitleme
    {"name": "Asit Banyo Sıcaklığı", "stage": "Asitleme", "target": 85, "unit": "°C", "type": "temp"},
    {"name": "Asit Konsantrasyonu (HCl)", "stage": "Asitleme", "target": 18, "unit": "%", "type": "flow"},
    {"name": "Tank pH Seviyesi", "stage": "Asitleme", "target": 1.2, "unit": "pH", "type": "flow"},
    {"name": "Sıyırıcı Rulo Basıncı", "stage": "Asitleme", "target": 4.2, "unit": "bar", "type": "pressure"},

    # Soğuk Haddehane (Arayüzdeki kartlarla tam eşleşen 4 sensör)
    {"name": "Merdane Kuvveti", "stage": "Soğuk Haddehane", "target": 10, "unit": "kN", "type": "pressure"},
    {"name": "Şerit Gerginliği", "stage": "Soğuk Haddehane", "target": 125, "unit": "kN", "type": "pressure"},
    {"name": "Rulman Sıcaklığı", "stage": "Soğuk Haddehane", "target": 60, "unit": "°C", "type": "temp"},
    {"name": "Emülsiyon Debisi", "stage": "Soğuk Haddehane", "target": 280, "unit": "L/dk", "type": "flow"}
]

def generate_time_series(sensor, is_anomalous):
    """0 - 180 saniye arası 19 adet zaman serisi noktası üretir."""
    target = sensor["target"]
    s_type = sensor["type"]
    series = []

    for step in range(19):
        sec = step * 10  # 0, 10, 20, ... 180
        val = target

        if not is_anomalous:
            # Normal durum: Ufak rastgele gürültü (%1-2)
            noise = (random.random() - 0.5) * (target * 0.02)
            val = target + noise
        else:
            # Anomali durumu: Fiziksel türe göre kırılma
            if s_type == "temp":
                # Sıcaklık anomalisinde yükselme eğrisi
                drift = (step / 18) * (target * 0.25)
                val = target + drift + random.uniform(-2, 2)
            elif s_type == "pressure":
                # Basınç ve kuvvet/gerginlikte aşırı yükseliş
                if step >= 5:
                    val = target * 1.35 + random.uniform(-1, 1)
                else:
                    val = target + random.uniform(-0.5, 0.5)
            elif s_type == "vibration":
                # Titreşimde zigzag gürültü
                noise = random.uniform(target * 0.3, target * 0.7)
                val = target + noise if step >= 5 else target
            else:
                # Akış ve pH kayması (Drift)
                val = target * (1 + (step / 18) * 0.8) if step >= 4 else target

        series.append((sec, round(val, 2)))

    return series

def insert_batch_data(coil_id, anomalous_sensor_name):
    """Üretilen verileri veritabanına basar."""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()

        print(f"🔄 '{coil_id}' için veriler veritabanına işleniyor...")

        # 1. 'coils' tablosundaki NOT NULL kısıtlamasını aşmak için bobini kaydet
        cursor.execute("""
            INSERT INTO coils (coil_id, steel_grade)
            VALUES (%s, 'DX51D')
            ON CONFLICT (coil_id) DO NOTHING;
        """, (coil_id,))

        # 2. Önceki eski kayıtları temizle
        cursor.execute("DELETE FROM sensor_readings WHERE coil_id = %s;", (coil_id,))

        total_inserted = 0
        for sensor in SENSORS:
            is_anomalous = (sensor["name"] == anomalous_sensor_name)
            time_series = generate_time_series(sensor, is_anomalous)

            for sec, actual_val in time_series:
                status = "ANOMALI" if (is_anomalous and sec >= 50) else "NORMAL"

                query = """
                    INSERT INTO sensor_readings 
                    (coil_id, sensor_key, stage_name, time_second, actual_value, target_value, unit, status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
                """
                cursor.execute(query, (
                    coil_id,
                    sensor["name"],
                    sensor["stage"],
                    sec,
                    actual_val,
                    sensor["target"],
                    sensor["unit"],
                    status
                ))
                total_inserted += 1

        conn.commit()
        cursor.close()
        conn.close()
        print(f"✅ Başarılı! '{coil_id}' için toplam {total_inserted} adet zaman serisi kaydı eklendi.\n")

    except Exception as e:
        print(f"❌ Veritabanı Hatası: {e}\n")

if __name__ == "__main__":
    # Örnek Test Senaryoları:
    insert_batch_data("BOBIN-2026-9043", "Cüruf Kalınlığı")
    insert_batch_data("BOBIN-2026-9044", "Emülsiyon Debisi")

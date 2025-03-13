import requests
import json

api_url = "https://www.unitestudents.com/api/configurator/searchResults"

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Content-Type": "application/json"
}

# 搞个遍历
cities = ["AB","BA","BI","BH","BS","CF","CV","DH","EH","GL","LD","LC","LV","LE","LG","MC","MD","NE","NG","OX","PO","SF","SH"] 

# 存储所有爬取数据
all_unis = []

for city in cities:
    print(f"正在爬取 {city} ...")
    
    payload = {
        "academicYear": "25/26",
        "city": city,
        "lengthOfStay": "Full Year,Academic Year",
        "property": None,
        "roomTypes": None,
        "stlEndDate": None,
        "stlStartDate": None,
        "university": None
    }

    response = requests.post(api_url, headers=headers, json=payload)

    if response.status_code == 200:
        data = response.json()

        if "universityDataList" in data["data"]:
            for uni in data["data"]["universityDataList"]:
                name = uni["name"]
                lat = uni.get("latitude")
                lon = uni.get("longitude")

                if lat and lon:
                    all_unis.append({
                        "name": name,
                        "latitude": lat,
                        "longitude": lon,
                        "city": city
                    })

        print(f"{city} 爬取完成，共 {len(data['data'].get('universityDataList', []))} 所大学")

    else:
        print(f"{city} API 请求失败，状态码: {response.status_code}")


js_content = f"const uniData = {json.dumps(all_unis, indent=4)};\n\nexport default uniData;"


with open("./src/js/data/uni.js", "w", encoding="utf-8") as f:
    f.write(js_content)

print("Done!!!!!oioioioio!!!")

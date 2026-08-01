package app.scapestack.runelite;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import okhttp3.Response;
import okhttp3.ResponseBody;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

final class ServerResponseSummary {

    private ServerResponseSummary() {}

    static final class AcceptedCounts {
        final Integer skills;
        final Integer quests;
        final Integer diaries;
        final Integer collectionLogItems;
        final Integer bankItems;

        AcceptedCounts(Integer skills, Integer quests, Integer diaries, Integer collectionLogItems, Integer bankItems) {
            this.skills = skills;
            this.quests = quests;
            this.diaries = diaries;
            this.collectionLogItems = collectionLogItems;
            this.bankItems = bankItems;
        }
    }

    static final class PanelAnswer {
        final String title;
        final String detail;
        final String stopAt;
        final String current;
        final String left;
        final Integer spriteItemId;

        PanelAnswer(String title, String detail, String stopAt, String current, String left, Integer spriteItemId) {
            this.title = title;
            this.detail = detail;
            this.stopAt = stopAt;
            this.current = current;
            this.left = left;
            this.spriteItemId = spriteItemId;
        }
    }

    static final class PanelReceipt {
        final List<PanelAnswer> answers;
        final String bankInsight;

        PanelReceipt(List<PanelAnswer> answers, String bankInsight) {
            this.answers = Collections.unmodifiableList(new ArrayList<>(answers));
            this.bankInsight = bankInsight;
        }
    }

    static String readBody(Response response) {
        ResponseBody body = response.body();
        if (body == null) return "";
        try {
            return body.string();
        } catch (IOException ex) {
            return "";
        }
    }

    static String failureDetail(int statusCode, String body) {
        String error = errorFromBody(body);
        if (!error.isEmpty()) return limit(error, 140);
        return "HTTP " + statusCode;
    }

    static String logDetail(int statusCode, String body) {
        String error = errorFromBody(body);
        if (!error.isEmpty()) return "HTTP " + statusCode + ": " + limit(error, 240);
        String compact = limit(body, 240);
        return compact.isEmpty() ? "HTTP " + statusCode : "HTTP " + statusCode + ": " + compact;
    }

    static String errorFromBody(String body) {
        if (body == null || body.isBlank()) return "";
        try {
            JsonElement parsed = new JsonParser().parse(body);
            if (!parsed.isJsonObject()) return "";
            JsonObject object = parsed.getAsJsonObject();
            JsonElement error = object.get("error");
            if (error == null || !error.isJsonPrimitive()) return "";
            return error.getAsString().trim();
        } catch (RuntimeException ex) {
            return "";
        }
    }

    static AcceptedCounts acceptedCounts(String body) {
        if (body == null || body.isBlank()) return null;
        try {
            JsonElement parsed = new JsonParser().parse(body);
            if (!parsed.isJsonObject()) return null;
            JsonObject root = parsed.getAsJsonObject();
            JsonElement countsElement = root.get("counts");
            if (countsElement == null || !countsElement.isJsonObject()) return null;
            JsonObject counts = countsElement.getAsJsonObject();
            return new AcceptedCounts(
                integerField(counts, "skills"),
                integerField(counts, "quests"),
                integerField(counts, "diaries"),
                integerField(counts, "collectionLogItems"),
                integerField(counts, "bankItems")
            );
        } catch (RuntimeException ex) {
            return null;
        }
    }

    static boolean hasNewProgress(String body) {
        if (body == null || body.isBlank()) return false;
        try {
            JsonElement parsed = new JsonParser().parse(body);
            if (!parsed.isJsonObject()) return false;
            JsonObject root = parsed.getAsJsonObject();
            JsonElement summaryElement = root.get("syncSummary");
            if (summaryElement == null || !summaryElement.isJsonObject()) return false;
            JsonObject summary = summaryElement.getAsJsonObject();
            return arrayHasItems(summary, "questsCompleted")
                || arrayHasItems(summary, "diariesCompleted")
                || arrayHasItems(summary, "collectionLogItemIds");
        } catch (RuntimeException ex) {
            return false;
        }
    }

    static PanelReceipt panelReceipt(String body) {
        if (body == null || body.isBlank()) return null;
        try {
            JsonElement parsed = new JsonParser().parse(body);
            if (!parsed.isJsonObject()) return null;
            JsonElement panelElement = parsed.getAsJsonObject().get("panel");
            if (panelElement == null || !panelElement.isJsonObject()) return null;
            JsonObject panel = panelElement.getAsJsonObject();
            List<PanelAnswer> answers = new ArrayList<>();
            JsonElement answersElement = panel.get("answers");
            if (answersElement != null && answersElement.isJsonArray()) {
                for (JsonElement element : answersElement.getAsJsonArray()) {
                    if (!element.isJsonObject() || answers.size() >= 3) continue;
                    JsonObject answer = element.getAsJsonObject();
                    String title = stringField(answer, "title", 70);
                    String detail = stringField(answer, "detail", 150);
                    String stopAt = stringField(answer, "stopAt", 80);
                    String current = stringField(answer, "current", 40);
                    String left = stringField(answer, "left", 40);
                    Integer spriteItemId = integerField(answer, "spriteItemId");
                    if (spriteItemId != null && (spriteItemId <= 0 || spriteItemId >= 1_000_000)) {
                        spriteItemId = null;
                    }
                    if (title.isEmpty() || detail.isEmpty()) continue;
                    answers.add(new PanelAnswer(title, detail, stopAt, current, left, spriteItemId));
                }
            }
            String bankInsight = stringField(panel, "bankInsight", 220);
            if (answers.isEmpty() && bankInsight.isEmpty()) return null;
            return new PanelReceipt(answers, bankInsight.isEmpty() ? null : bankInsight);
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private static boolean arrayHasItems(JsonObject object, String key) {
        JsonElement element = object.get(key);
        return element != null && element.isJsonArray() && element.getAsJsonArray().size() > 0;
    }

    private static Integer integerField(JsonObject object, String key) {
        JsonElement element = object.get(key);
        if (element == null || !element.isJsonPrimitive()) return null;
        try {
            Number value = element.getAsNumber();
            return Math.max(0, value.intValue());
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private static String stringField(JsonObject object, String key, int max) {
        JsonElement element = object.get(key);
        if (element == null || !element.isJsonPrimitive() || !element.getAsJsonPrimitive().isString()) return "";
        return limit(element.getAsString(), max);
    }

    private static String limit(String value, int max) {
        if (value == null) return "";
        String compact = value.replaceAll("\\s+", " ").trim();
        if (compact.length() <= max) return compact;
        return compact.substring(0, Math.max(0, max - 1)) + "…";
    }
}

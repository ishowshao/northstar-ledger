import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { customersApi, invoicesApi, projectsApi } from "../lib/api.js";

interface InvoiceFormData {
  customerId: string;
  projectId: string;
  issueDate: string;
  dueDate: string;
  taxRate: number;
  discount: number;
  notes: string;
  billingName: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export default function InvoiceForm() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: customersApi.list,
  });

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
  });

  const now = new Date();
  const defaultDue = new Date(now);
  defaultDue.setDate(defaultDue.getDate() + 30);

  const { register, control, handleSubmit, watch } = useForm<InvoiceFormData>({
    defaultValues: {
      customerId: "",
      projectId: "",
      issueDate: now.toISOString().slice(0, 10),
      dueDate: defaultDue.toISOString().slice(0, 10),
      taxRate: 0,
      discount: 0,
      notes: "",
      billingName: "",
      items: [{ description: "", quantity: 1, unitPrice: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const items = watch("items");
  const taxRate = watch("taxRate");
  const discount = watch("discount");

  const subtotal =
    items?.reduce((sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0) ?? 0;
  const taxAmount = Math.round((subtotal * (taxRate || 0)) / 100);
  const totalAmount = subtotal + taxAmount - (discount || 0);

  const mutation = useMutation({
    mutationFn: invoicesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      navigate("/invoices");
    },
  });

  return (
    <div>
      <h2>新建发票</h2>
      <form
        onSubmit={handleSubmit((data) =>
          mutation.mutate({
            ...data,
            customerId: data.customerId || undefined,
            projectId: data.projectId || undefined,
            taxRate: Number(data.taxRate),
            discount: Number(data.discount),
            items: data.items.map((item) => ({
              ...item,
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
            })),
          }),
        )}
        className="form form-wide"
      >
        <div className="form-row">
          <div className="form-field">
            <label>开票日期 *</label>
            <input type="date" {...register("issueDate", { required: true })} />
          </div>
          <div className="form-field">
            <label>到期日期 *</label>
            <input type="date" {...register("dueDate", { required: true })} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>客户</label>
            <select {...register("customerId")}>
              <option value="">无</option>
              {customers?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>项目</label>
            <select {...register("projectId")}>
              <option value="">无</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-field">
          <label>发票抬头</label>
          <input {...register("billingName")} placeholder="客户公司名称（可选）" />
        </div>

        <h3 style={{ marginTop: "1.5rem", marginBottom: "0.75rem" }}>发票条目</h3>

        <div className="invoice-items">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: "40%" }}>项目描述</th>
                <th style={{ width: "15%", textAlign: "center" }}>数量</th>
                <th style={{ width: "20%", textAlign: "right" }}>单价（分）</th>
                <th style={{ width: "15%", textAlign: "right" }}>金额</th>
                <th style={{ width: "10%" }} />
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => {
                const qty = watch(`items.${index}.quantity`) || 0;
                const price = watch(`items.${index}.unitPrice`) || 0;
                const lineAmount = qty * price;
                return (
                  <tr key={field.id}>
                    <td>
                      <input
                        {...register(`items.${index}.description`, { required: "请填写描述" })}
                        placeholder="如：网站设计服务"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        {...register(`items.${index}.quantity`, { valueAsNumber: true, min: 1 })}
                        style={{ textAlign: "center" }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        {...register(`items.${index}.unitPrice`, { valueAsNumber: true, min: 0 })}
                        style={{ textAlign: "right" }}
                      />
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>
                      {(lineAmount / 100).toFixed(2)}
                    </td>
                    <td>
                      {fields.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => remove(index)}
                        >
                          删除
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button
            type="button"
            className="btn"
            style={{ marginTop: "0.5rem" }}
            onClick={() => append({ description: "", quantity: 1, unitPrice: 0 })}
          >
            + 添加条目
          </button>
        </div>

        <div className="form-row" style={{ marginTop: "1rem" }}>
          <div className="form-field">
            <label>税率 (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              {...register("taxRate", { valueAsNumber: true })}
            />
          </div>
          <div className="form-field">
            <label>折扣（分）</label>
            <input type="number" min="0" {...register("discount", { valueAsNumber: true })} />
          </div>
        </div>

        <div className="invoice-totals-preview">
          <p>小计: {(subtotal / 100).toFixed(2)}</p>
          {taxRate > 0 && (
            <p>
              税额 ({taxRate}%): {(taxAmount / 100).toFixed(2)}
            </p>
          )}
          {discount > 0 && <p>折扣: -{(discount / 100).toFixed(2)}</p>}
          <p className="total-final">总计: {(totalAmount / 100).toFixed(2)}</p>
        </div>

        <div className="form-field">
          <label>备注</label>
          <textarea {...register("notes")} rows={2} />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? "创建中..." : "创建发票"}
          </button>
          <button type="button" className="btn" onClick={() => navigate("/invoices")}>
            取消
          </button>
        </div>
        {mutation.isError && <p className="error">创建失败: {(mutation.error as Error).message}</p>}
      </form>
    </div>
  );
}
